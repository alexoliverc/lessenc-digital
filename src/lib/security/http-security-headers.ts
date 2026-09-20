const contentSecurityPolicyDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com https://www.googletagmanager.com https://connect.facebook.net",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.facebook.com",
  "font-src 'self' data:",
  "connect-src 'self' https://api.mercadopago.com https://*.mercadopago.com https://*.mercadopago.com.br https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://stats.g.doubleclick.net https://www.facebook.com",
  "frame-src https://www.mercadopago.com https://*.mercadopago.com https://www.mercadopago.com.br https://*.mercadopago.com.br",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
];

function contentSecurityPolicy(appEnv: string | undefined, dynamicAcsFrames = false) {
  const hosted = appEnv === "staging" || appEnv === "production";

  const directives = dynamicAcsFrames
    ? contentSecurityPolicyDirectives.map((directive) =>
        directive.startsWith("frame-src ") ? "frame-src https:" : directive,
      )
    : contentSecurityPolicyDirectives;

  return [...directives, ...(hosted ? ["upgrade-insecure-requests"] : [])].join("; ");
}

export function globalSecurityHeaders(appEnv = process.env.APP_ENV) {
  const hosted = appEnv === "staging" || appEnv === "production";

  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(appEnv) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), geolocation=(), microphone=(), browsing-topics=(), usb=(), payment=(self)",
    },
    { key: "X-Frame-Options", value: "DENY" },
  ];

  if (hosted) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000",
    });
  }

  return headers;
}

export function checkoutPaymentSecurityHeaders(appEnv = process.env.APP_ENV) {
  return [
    {
      key: "Content-Security-Policy",
      value: contentSecurityPolicy(appEnv, true),
    },
  ];
}

export function securityHeaderRules(appEnv = process.env.APP_ENV) {
  return [
    {
      source: "/:path*",
      headers: globalSecurityHeaders(appEnv),
    },
    {
      source: "/checkout/payment",
      headers: checkoutPaymentSecurityHeaders(appEnv),
    },
  ];
}
