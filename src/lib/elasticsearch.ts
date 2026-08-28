import { Client } from "@elastic/elasticsearch";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

const indexName = "scheduled-emails";
export const elastic = env.ELASTICSEARCH_ENABLED ? new Client({ node: env.ELASTICSEARCH_URL }) : null;

export async function ensureEmailIndex() {
  if (!elastic) return;
  try {
    const exists = await elastic.indices.exists({ index: indexName });
    if (!exists) await elastic.indices.create({
      index: indexName,
      mappings: { properties: {
        userId: { type: "keyword" }, campaignId: { type: "keyword" }, recipient: { type: "keyword" },
        subject: { type: "text" }, status: { type: "keyword" }, scheduledAt: { type: "date" }, sentAt: { type: "date" }
      } }
    });
  } catch (error) {
    logger.warn({ err: error }, "Elasticsearch unavailable; API continues with database search");
  }
}

export async function indexEmail(document: Record<string, unknown> & { id: string }) {
  if (!elastic) return;
  try {
    const { id, ...body } = document;
    await elastic.index({ index: indexName, id, document: body, refresh: false });
  } catch (error) {
    logger.warn({ err: error, emailId: document.id }, "Email indexing failed");
  }
}

export async function indexEmails(documents: Array<Record<string, unknown> & { id: string }>) {
  if (!elastic || documents.length === 0) return;
  try {
    const operations = documents.flatMap(({ id, ...document }) => [
      { index: { _index: indexName, _id: id } }, document
    ]);
    const result = await elastic.bulk({ operations, refresh: false });
    if (result.errors) logger.warn("Some scheduled email documents failed Elasticsearch bulk indexing");
  } catch (error) {
    logger.warn({ err: error }, "Scheduled email bulk indexing failed");
  }
}

export async function searchEmailIds(userId: string, search: string, limit: number) {
  if (!elastic) return null;
  try {
    const result = await elastic.search({
      index: indexName,
      size: limit,
      query: { bool: { filter: [{ term: { userId } }], must: [{ multi_match: { query: search, fields: ["subject", "recipient"] } }] } }
    });
    return result.hits.hits.map((hit) => hit._id).filter((id): id is string => Boolean(id));
  } catch (error) {
    logger.warn({ err: error }, "Elasticsearch search failed; falling back to Postgres");
    return null;
  }
}
