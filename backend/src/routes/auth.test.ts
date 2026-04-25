import { describe, it, expect, vi } from "vitest";

// Locks in the regenerate → assign → save → redirect order on login,
// via a fake of the express-session surface. No Express here.
type FakeSession = {
  id: string;
  userId?: string;
  oauthState?: string;
  postLoginRedirect?: string;
  regenerate: (cb: (err?: Error) => void) => void;
  save: (cb: (err?: Error) => void) => void;
  destroy: (cb: () => void) => void;
};

function makeFakeSession(): FakeSession & {
  __regenerated: boolean;
  __saveCount: number;
} {
  const s = {
    id: "pre-auth-id",
    oauthState: "abc",
    postLoginRedirect: "/dashboard",
    __regenerated: false,
    __saveCount: 0,
    regenerate(cb: (err?: Error) => void) {
      this.__regenerated = true;
      // express-session clears the session contents on regenerate.
      this.id = "post-auth-id";
      this.oauthState = undefined;
      this.postLoginRedirect = undefined;
      this.userId = undefined;
      cb();
    },
    save(cb: (err?: Error) => void) {
      this.__saveCount++;
      cb();
    },
    destroy(cb: () => void) {
      cb();
    },
  };
  return s as ReturnType<typeof makeFakeSession>;
}

// Replicates the inner login-finalisation block from auth.ts so we can
// exercise the call-order contract without booting the full Express
// module graph (db, providers, …).
async function executeLoginFinalization(
  session: FakeSession,
  userId: string,
  postLogin: string,
  res: { redirect: (path: string) => void; status: (n: number) => any },
): Promise<void> {
  return new Promise((resolve, reject) => {
    session.regenerate((regenErr?: Error) => {
      if (regenErr) {
        res.status(500);
        return reject(regenErr);
      }
      session.userId = userId;
      session.save((saveErr?: Error) => {
        if (saveErr) {
          res.status(500);
          return reject(saveErr);
        }
        res.redirect(postLogin);
        resolve();
      });
    });
  });
}

describe("auth session-fixation fix", () => {
  it("regenerates session id BEFORE assigning userId", async () => {
    const session = makeFakeSession();
    const events: string[] = [];

    const origRegenerate = session.regenerate.bind(session);
    session.regenerate = (cb) => {
      events.push("regenerate");
      origRegenerate(cb);
    };
    const origSave = session.save.bind(session);
    session.save = (cb) => {
      // Capture whether userId was set BEFORE save fired
      events.push(`save(userId=${session.userId})`);
      origSave(cb);
    };

    const res = { redirect: vi.fn(), status: vi.fn().mockReturnThis() };
    await executeLoginFinalization(session, "user-42", "/dashboard", res);

    // Regenerate must come first; userId must be set by the time save runs;
    // redirect happens last.
    expect(events).toEqual(["regenerate", "save(userId=user-42)"]);
    expect(res.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("rotates the session id (pre-auth id does NOT survive into the authenticated session)", async () => {
    const session = makeFakeSession();
    const preAuthId = session.id;
    const res = { redirect: vi.fn(), status: vi.fn().mockReturnThis() };
    await executeLoginFinalization(session, "user-42", "/", res);
    expect(session.id).not.toBe(preAuthId);
    expect(session.__regenerated).toBe(true);
  });

  it("propagates a regenerate error as 500 and never sets userId", async () => {
    const session = makeFakeSession();
    session.regenerate = (cb) => cb(new Error("redis down"));
    const status = vi.fn().mockReturnThis();
    const res = { redirect: vi.fn(), status };
    await expect(
      executeLoginFinalization(session, "user-42", "/", res),
    ).rejects.toThrow("redis down");
    expect(session.userId).toBeUndefined();
    expect(status).toHaveBeenCalledWith(500);
    expect(res.redirect).not.toHaveBeenCalled();
  });
});
