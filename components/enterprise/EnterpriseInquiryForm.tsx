"use client";

import React, { useState, startTransition } from "react";

type Source = "enterprise" | "partners" | "demo" | "pricing";

export function EnterpriseInquiryForm({
  source = "enterprise",
  defaultSso = false,
  defaultHolding = false,
  defaultSla = true,
}: {
  source?: Source;
  defaultSso?: boolean;
  defaultHolding?: boolean;
  defaultSla?: boolean;
}) {
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [installations, setInstallations] = useState("3");
  const [needSso, setNeedSso] = useState(defaultSso);
  const [needHolding, setNeedHolding] = useState(defaultHolding);
  const [needSla, setNeedSla] = useState(defaultSla);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [mailto, setMailto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/enterprise/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          name,
          email,
          installations: Number(installations),
          needSso,
          needHolding,
          needSla,
          message,
          source,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; mailto?: string; code?: string };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setError(data.code || "Unable to submit inquiry");
        return;
      }
      startTransition(() => {
        setMailto(data.mailto || null);
        setStatus("ok");
      });
    } catch {
      setStatus("error");
      setError("Network error — email info@cbamvalid.com directly");
    }
  }

  if (status === "ok") {
    return (
      <div className="deliv-card" style={{ maxWidth: "640px" }}>
        <span className="fmt">RECEIVED</span>
        <h3>Inquiry captured</h3>
        <p>
          We logged your Enterprise request. For fastest response, also send the prepared email so
          nothing is lost if mail filters delay us.
        </p>
        {mailto ? (
          <a className="btn btn-primary" href={mailto} style={{ marginTop: "14px" }}>
            Open email to info@cbamvalid.com
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <form className="enterprise-inquiry" onSubmit={onSubmit} noValidate>
      <div className="enterprise-inquiry-grid">
        <label>
          Company
          <input value={company} onChange={(e) => setCompany(e.target.value)} required maxLength={200} />
        </label>
        <label>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </label>
        <label>
          Work email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={200}
          />
        </label>
        <label>
          Installations (approx.)
          <input
            type="number"
            min={1}
            max={10000}
            value={installations}
            onChange={(e) => setInstallations(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="enterprise-inquiry-checks">
        <label>
          <input type="checkbox" checked={needSso} onChange={(e) => setNeedSso(e.target.checked)} />
          SSO / IdP federation
        </label>
        <label>
          <input
            type="checkbox"
            checked={needHolding}
            onChange={(e) => setNeedHolding(e.target.checked)}
          />
          Holding / multi-entity
        </label>
        <label>
          <input type="checkbox" checked={needSla} onChange={(e) => setNeedSla(e.target.checked)} />
          SLA / DPA path
        </label>
      </div>
      <label className="enterprise-inquiry-message">
        Scope notes
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="CN families, reporting year, IdP (Entra / Google / Okta), holding structure…"
        />
      </label>
      {error ? <p className="enterprise-inquiry-error">{error}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Request Enterprise scoping"}
      </button>
    </form>
  );
}
