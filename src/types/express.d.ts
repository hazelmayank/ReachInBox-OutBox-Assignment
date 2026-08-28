import type { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
import type { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
