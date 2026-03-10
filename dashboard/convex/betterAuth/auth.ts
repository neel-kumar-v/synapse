import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";

async function sendResendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // console.warn("[Resend] RESEND_API_KEY not set in Convex env; skipping email. Set it in Convex dashboard (Settings → Environment Variables) to send verification/password-reset emails.");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: "Synapse <onboarding@resend.dev>", to, subject, html }),
  });
  const body = await res.json();
  console.log("[Resend]", res.status, JSON.stringify(body));
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${JSON.stringify(body)}`);
}

// Better Auth Component
export const authComponent = createClient<DataModel>(
  components.betterAuth,
  {
    verbose: false,
  },
);

// Better Auth Options
export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const socialProviders: BetterAuthOptions["socialProviders"] = {};
  
  // Register Google provider - always include it so better-auth recognizes it
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (googleClientId && googleClientSecret) {
    socialProviders.google = {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      enabled: true,
    };
  } else {
    // Register provider but disabled - requires env vars to be set in Convex
    socialProviders.google = {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: false,
    };
  }
  
  // Register GitHub provider - always include it so better-auth recognizes it
  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (githubClientId && githubClientSecret) {
    socialProviders.github = {
      clientId: githubClientId,
      clientSecret: githubClientSecret,
      enabled: true,
    };
  } else {
    // Register provider but disabled - requires env vars to be set in Convex
    socialProviders.github = {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      enabled: false,
    };
  }

  // For /api/auth/convex/token to return 200 (not 401): set in Convex dashboard (Settings → Environment Variables):
  // - SITE_URL = your app URL (e.g. http://localhost:3000 in dev)
  // - BETTER_AUTH_SECRET = a random secret (same value everywhere you run auth)
  return {
    appName: "My App",
    baseURL: process.env.SITE_URL || "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET || "change-me-in-production",
    database: authComponent.adapter(ctx),
    // Verification email is optional: we send it when RESEND_API_KEY is set, but never require it to sign in.
    emailVerification: {
      sendVerificationEmail: async (data) => {
        // console.log("[emailVerification] sendVerificationEmail called for:", data.user.email);
        try {
          await sendResendEmail(
            data.user.email,
            "Verify your Synapse email",
            `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0b0d11;color:#e4e7ed;border-radius:12px">
              <div style="margin-bottom:24px">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;background:linear-gradient(135deg,#6c72cb,#8187de);border-radius:8px;font-weight:700;font-size:16px;color:#fff">S</span>
                <span style="margin-left:10px;font-weight:700;font-size:18px;vertical-align:middle">Synapse</span>
              </div>
              <h1 style="font-size:22px;font-weight:700;margin:0 0 10px">Verify your email</h1>
              <p style="color:#7a8194;font-size:14px;line-height:1.6;margin:0 0 24px">
                Click the button below to verify your email address and activate your account.
              </p>
              <a href="${data.url}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#6c72cb,#8187de);color:#fff;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none">
                Verify Email
              </a>
              <p style="color:#7a8194;font-size:12px;margin-top:24px">
                If you didn't create a Synapse account, you can safely ignore this email.
              </p>
            </div>`,
          );
        } catch (e) {
          // console.warn("[emailVerification] Failed to send (optional):", e);
        }
      },
      sendOnSignUp: !!process.env.RESEND_API_KEY,
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: async (data) => {
        await sendResendEmail(
          data.user.email,
          "Reset your Synapse password",
          `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0b0d11;color:#e4e7ed;border-radius:12px">
            <div style="margin-bottom:24px">
              <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;background:linear-gradient(135deg,#6c72cb,#8187de);border-radius:8px;font-weight:700;font-size:16px;color:#fff">S</span>
              <span style="margin-left:10px;font-weight:700;font-size:18px;vertical-align:middle">Synapse</span>
            </div>
            <h1 style="font-size:22px;font-weight:700;margin:0 0 10px">Reset your password</h1>
            <p style="color:#7a8194;font-size:14px;line-height:1.6;margin:0 0 24px">
              We received a request to reset your password. Click the button below to choose a new one.
            </p>
            <a href="${data.url}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#6c72cb,#8187de);color:#fff;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none">
              Reset Password
            </a>
            <p style="color:#7a8194;font-size:12px;margin-top:24px">
              If you didn't request a password reset, you can safely ignore this email. The link expires in 1 hour.
            </p>
          </div>`,
        );
      },
    },
    socialProviders,
    plugins: [convex({ authConfig })],
  } satisfies BetterAuthOptions;
};

// For `@better-auth/cli`
export const options = createAuthOptions({} as GenericCtx<DataModel>);

// Better Auth Instance
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};