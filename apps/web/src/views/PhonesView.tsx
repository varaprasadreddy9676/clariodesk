import {
  CheckCircle2,
  Plus,
  QrCode,
  RefreshCcw,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ApiPhone, ClarioApiClient } from "../api.js";
import { LottiePlayer } from "../components/LottiePlayer.js";
import { PanelTitle } from "../components/PanelTitle.js";
import confettiBurstAnimation from "../lottie/confetti-burst.json";
import qrPulseAnimation from "../lottie/qr-pulse.json";
import { formatTime } from "../lib/ui-mappers.js";
import { toQrImage } from "../lib/qr.js";

export function PhonesView({
  api,
  phones,
  onChanged,
  runAction,
}: {
  api: ClarioApiClient;
  phones: ApiPhone[];
  onChanged: () => Promise<void>;
  runAction: (action: () => Promise<void>, success: string) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("Clario Gateway Support");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [gatewayBaseUrl, setGatewayBaseUrl] = useState("http://localhost:2786");
  const [apiKey, setApiKey] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [phoneResult, setPhoneResult] = useState<string | null>(null);
  const autoSyncedPhones = useRef(new Set<string>());
  const autoQrRequestedPhones = useRef(new Set<string>());
  // Confetti plays only on an actual qr/disconnected → connected transition
  // observed during this mount — not just from opening an already-connected
  // phone's screen.
  const previousPhoneStatus = useRef<string | null>(null);
  const [justConnectedId, setJustConnectedId] = useState<string | null>(null);

  async function doPhoneAction(
    key: string,
    action: () => Promise<string | void>,
    success: string,
  ) {
    setActionKey(key);
    setPhoneResult(null);
    await runAction(async () => {
      const detail = await action();
      if (detail) setPhoneResult(detail);
    }, success);
    setActionKey(null);
  }

  /**
   * One-click link: connect the existing phone if there is one, otherwise
   * create a default phone, then fetch the QR. No form required.
   */
  async function startLink() {
    await doPhoneAction(
      "link",
      async () => {
        let phoneId = primaryPhone?.id;
        if (!phoneId) {
          const created = await api.createPhone({
            adapterType: "clario_gateway",
            displayName: "WhatsApp",
            providerInstanceId: `wa-${Math.random().toString(36).slice(2, 8)}`,
          });
          phoneId = created.id;
          await onChanged();
        }
        let qrValue = (await api.connectPhone(phoneId)).qr;
        // An already-linked number resumes its saved session and returns no QR.
        // Force a fresh QR by re-pairing (logout clears the saved session).
        if (!qrValue) {
          qrValue = (await api.repairPhone(phoneId)).qr;
        }
        setQr(qrValue ?? "Generating QR — refresh in a moment.");
        setQrImage(qrValue ? await toQrImage(qrValue) : null);
        await onChanged();
        return qrValue ? "Scan the QR with WhatsApp." : "Generating QR…";
      },
      "Link started",
    );
  }

  const sortedPhones = [...phones].sort((a, b) => {
    const statusScore = (status: string) =>
      status === "connected" ? 0 : status === "syncing" ? 1 : 2;
    return (
      statusScore(a.status) - statusScore(b.status) ||
      a.displayName.localeCompare(b.displayName)
    );
  });
  const gatewayPhones = sortedPhones.filter(
    (phone) => phone.adapterType === "clario_gateway",
  );
  const hiddenDevPhones = gatewayPhones.filter(
    (phone) =>
      phone.displayName.toLowerCase().startsWith("e2e phone") ||
      phone.providerInstanceId?.startsWith("e2e-"),
  );
  const visiblePhones = gatewayPhones.filter(
    (phone) => !hiddenDevPhones.includes(phone),
  );
  const primaryPhone =
    visiblePhones.find(
      (phone) => phone.providerInstanceId === "clario-support",
    ) ??
    visiblePhones.find((phone) => phone.status === "connected") ??
    visiblePhones[0] ??
    null;
  const additionalPhones = visiblePhones.filter(
    (phone) => phone.id !== primaryPhone?.id,
  );
  const legacyPhones = sortedPhones.filter(
    (phone) => phone.adapterType !== "clario_gateway",
  );

  // Celebrate the moment a phone actually finishes connecting — this is the
  // "you're all set" payoff of the whole linking flow. Only fires on a real
  // transition witnessed during this mount, never on revisiting an
  // already-connected phone's screen.
  useEffect(() => {
    const status = primaryPhone?.status ?? null;
    const wasConnecting =
      previousPhoneStatus.current === "qr_required" ||
      previousPhoneStatus.current === "disconnected" ||
      previousPhoneStatus.current === "syncing";
    if (primaryPhone && status === "connected" && wasConnecting) {
      setJustConnectedId(primaryPhone.id);
      const timer = globalThis.setTimeout(() => setJustConnectedId(null), 1800);
      previousPhoneStatus.current = status;
      return () => globalThis.clearTimeout(timer);
    }
    previousPhoneStatus.current = status;
  }, [primaryPhone]);

  useEffect(() => {
    if (
      !primaryPhone ||
      (primaryPhone.status !== "qr_required" &&
        primaryPhone.status !== "disconnected") ||
      qrImage
    )
      return;
    if (autoQrRequestedPhones.current.has(primaryPhone.id)) return;

    autoQrRequestedPhones.current.add(primaryPhone.id);
    void (async () => {
      setActionKey(`${primaryPhone.id}:qr`);
      try {
        const result = await api.connectPhone(primaryPhone.id);
        if (!result.qr) {
          autoQrRequestedPhones.current.delete(primaryPhone.id);
          setPhoneResult("QR is still generating. It will retry shortly.");
          return;
        }
        setQr(result.qr);
        setQrImage(await toQrImage(result.qr));
        setPhoneResult("Scan the QR with WhatsApp.");
      } catch (err) {
        autoQrRequestedPhones.current.delete(primaryPhone.id);
        setPhoneResult(
          err instanceof Error ? err.message : "Unable to retrieve QR",
        );
      } finally {
        setActionKey(null);
      }
    })();
  }, [api, primaryPhone?.id, primaryPhone?.status, qrImage]);

  useEffect(() => {
    const currentPhones = [...phones].sort((a, b) => {
      const statusScore = (status: string) =>
        status === "connected" ? 0 : status === "syncing" ? 1 : 2;
      return (
        statusScore(a.status) - statusScore(b.status) ||
        a.displayName.localeCompare(b.displayName)
      );
    });
    const timer = window.setInterval(() => {
      for (const phone of currentPhones.filter(
        (item) => item.adapterType === "clario_gateway",
      )) {
        if (phone.status === "qr_required" || phone.status === "syncing") {
          void api.phoneStatus(phone.id).then(async (result) => {
            await onChanged();
            if (
              result.status === "connected" &&
              !autoSyncedPhones.current.has(phone.id)
            ) {
              autoSyncedPhones.current.add(phone.id);
              setPhoneResult(
                `Connected ${result.phoneNumber ?? phone.displayName}. Syncing chats...`,
              );
              await api.syncGroups(phone.id);
              await onChanged();
            }
            if (result.status !== "connected") {
              autoSyncedPhones.current.delete(phone.id);
            }
          });
        }
        if (
          phone.status === "connected" &&
          !autoSyncedPhones.current.has(phone.id)
        ) {
          autoSyncedPhones.current.add(phone.id);
          void (async () => {
            setPhoneResult(
              `Connected ${phone.phoneNumber ?? phone.displayName}. Syncing chats...`,
            );
            await api.syncGroups(phone.id);
            await onChanged();
          })();
        }
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [api, onChanged, phones]);

  return (
    <section className="page-panel">
      <PanelTitle
        title="WhatsApp connection"
        subtitle={
          primaryPhone
            ? "Linked device for ClarioDesk chat sync"
            : "Connect one WhatsApp number to begin"
        }
      />
      {phoneResult ? (
        <div
          className={`inline-result ${/error|fail/i.test(phoneResult) ? "inline-result-error" : ""}`}
          role={/error|fail/i.test(phoneResult) ? "alert" : "status"}
        >
          {phoneResult}
        </div>
      ) : null}
      {primaryPhone &&
      primaryPhone.status !== "qr_required" &&
      primaryPhone.status !== "disconnected" ? (
        <article className="phone-hero">
          {justConnectedId === primaryPhone.id ? (
            <div className="phone-hero-confetti" aria-hidden="true">
              <LottiePlayer animationData={confettiBurstAnimation} style={{ width: 220, height: 220 }} />
            </div>
          ) : null}
          <div className="phone-hero-main">
            <div
              className={`phone-hero-icon phone-hero-${primaryPhone.status}`}
            >
              {primaryPhone.status === "connected" ? (
                <CheckCircle2 size={24} aria-hidden="true" />
              ) : primaryPhone.status === "qr_required" ? (
                <QrCode size={24} aria-hidden="true" />
              ) : (
                <WifiOff size={24} aria-hidden="true" />
              )}
            </div>
            <div>
              <h2>{primaryPhone.displayName}</h2>
              <p>
                {primaryPhone.phoneNumber ??
                  "Number will appear after WhatsApp connects"}
              </p>
            </div>
          </div>
          <div className="phone-hero-status">
            <strong>
              {primaryPhone.status === "connected"
                ? "Connected"
                : primaryPhone.status.replace("_", " ")}
            </strong>
            <span>
              {primaryPhone.lastSyncAt
                ? `Last synced ${formatTime(primaryPhone.lastSyncAt)}`
                : "Chats will sync automatically after connection"}
            </span>
          </div>
          <div className="phone-hero-actions">
            {primaryPhone.status === "connected" ? (
              <>
                <button
                  type="button"
                  className="primary-action"
                  disabled={actionKey === `${primaryPhone.id}:sync`}
                  onClick={() =>
                    void doPhoneAction(
                      `${primaryPhone.id}:sync`,
                      async () => {
                        const result = await api.syncGroups(primaryPhone.id);
                        await onChanged();
                        autoSyncedPhones.current.add(primaryPhone.id);
                        return `${result.total} chats synced.`;
                      },
                      "Chats synced",
                    )
                  }
                >
                  <RefreshCcw size={15} aria-hidden="true" />
                  {actionKey === `${primaryPhone.id}:sync`
                    ? "Syncing..."
                    : "Sync now"}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={actionKey === `${primaryPhone.id}:repair`}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Re-pair will unlink the current WhatsApp device and stop syncing until you scan a new QR. Continue?",
                      )
                    )
                      return;
                    void doPhoneAction(
                      `${primaryPhone.id}:repair`,
                      async () => {
                        const result = await api.repairPhone(primaryPhone.id);
                        setQr(
                          result.qr ??
                            "Re-pair started. The QR will appear shortly — click Refresh.",
                        );
                        setQrImage(
                          result.qr ? await toQrImage(result.qr) : null,
                        );
                        await onChanged();
                        return result.qr
                          ? "Device unlinked. Scan the new QR to re-pair."
                          : "Device unlinked. Generating QR...";
                      },
                      "Re-pair started",
                    );
                  }}
                >
                  <QrCode size={15} aria-hidden="true" />
                  {actionKey === `${primaryPhone.id}:repair`
                    ? "Unlinking..."
                    : "Re-pair (new QR)"}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="primary-action"
                disabled={actionKey === `${primaryPhone.id}:connect`}
                onClick={() =>
                  void doPhoneAction(
                    `${primaryPhone.id}:connect`,
                    async () => {
                      const result = await api.connectPhone(primaryPhone.id);
                      setQr(
                        result.qr ??
                          "QR not returned by gateway yet. Try again in a few seconds.",
                      );
                      setQrImage(result.qr ? await toQrImage(result.qr) : null);
                      await onChanged();
                      return result.qr
                        ? "QR generated for scanning."
                        : "Session is already connected.";
                    },
                    "Connection requested",
                  )
                }
              >
                <QrCode size={15} aria-hidden="true" />
                {actionKey === `${primaryPhone.id}:connect`
                  ? "Opening..."
                  : "Connect"}
              </button>
            )}
            <button
              type="button"
              className="secondary-action"
              disabled={actionKey === `${primaryPhone.id}:status`}
              onClick={() =>
                void doPhoneAction(
                  `${primaryPhone.id}:status`,
                  async () => {
                    const result = await api.phoneStatus(primaryPhone.id);
                    await onChanged();
                    if (
                      result.status === "connected" &&
                      !autoSyncedPhones.current.has(primaryPhone.id)
                    ) {
                      autoSyncedPhones.current.add(primaryPhone.id);
                      await api.syncGroups(primaryPhone.id);
                      await onChanged();
                    }
                    return result.phoneNumber
                      ? `Connected number: ${result.phoneNumber}`
                      : `Status: ${result.status}`;
                  },
                  "Status refreshed",
                )
              }
            >
              {actionKey === `${primaryPhone.id}:status`
                ? "Checking..."
                : "Refresh"}
            </button>
          </div>
        </article>
      ) : qr ? (
        <article className="wa-link">
          <div className="wa-link-info">
            <h2>Link a device</h2>
            <ol className="wa-link-steps">
              <li>
                Open <strong>WhatsApp</strong> on your phone
              </li>
              <li>
                Tap <strong>Menu</strong> or <strong>Settings</strong> and
                select <strong>Linked devices</strong>
              </li>
              <li>
                Tap <strong>Link a device</strong>
              </li>
              <li>Point your phone at this screen to capture the code</li>
            </ol>
            <button
              type="button"
              className="secondary-action"
              disabled={actionKey === "link"}
              onClick={() => void startLink()}
            >
              <RefreshCcw size={15} aria-hidden="true" />
              {actionKey === "link" ? "Refreshing…" : "Refresh QR"}
            </button>
          </div>
          <div className="wa-link-qr">
            {qrImage ? (
              <img src={qrImage} alt="WhatsApp link QR code" />
            ) : (
              <div className="wa-qr-pending">
                <LottiePlayer animationData={qrPulseAnimation} loop style={{ width: 64, height: 64 }} />
                <span>Generating…</span>
              </div>
            )}
          </div>
        </article>
      ) : (
        <article className="wa-link">
          <div className="wa-link-info">
            <h2>Link a device</h2>
            <p className="wa-link-lead">
              Connect your WhatsApp number to start receiving group messages in
              ClarioDesk.
            </p>
            <ol className="wa-link-steps">
              <li>
                Open <strong>WhatsApp</strong> on your phone
              </li>
              <li>
                Tap <strong>Menu</strong> or <strong>Settings</strong> and
                select <strong>Linked devices</strong>
              </li>
              <li>
                Tap <strong>Link a device</strong>
              </li>
              <li>Scan the QR that appears after you tap the button below</li>
            </ol>
            <button
              type="button"
              className="primary-action wa-link-button"
              disabled={actionKey === "link"}
              onClick={() => void startLink()}
            >
              <QrCode size={16} aria-hidden="true" />
              {actionKey === "link" ? "Starting…" : "Link a device"}
            </button>
          </div>
          <div className="wa-link-qr wa-link-qr-empty">
            <Smartphone size={48} aria-hidden="true" />
          </div>
        </article>
      )}

      {visiblePhones.length > 0 ? (
        <details className="phone-setup-panel">
          <summary>
            <Plus size={16} aria-hidden="true" />
            Add another number
          </summary>
          <div className="phone-setup">
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Display name"
            />
            <input
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="WhatsApp number, optional"
            />
            <button
              type="button"
              className="secondary-action"
              onClick={() => setAdvancedOpen((value) => !value)}
            >
              {advancedOpen ? "Hide custom gateway" : "Use a custom gateway"}
            </button>
            {advancedOpen ? (
              <>
                <input
                  value={gatewayBaseUrl}
                  onChange={(event) => setGatewayBaseUrl(event.target.value)}
                  placeholder="Gateway base URL"
                />
                <input
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="API key"
                />
              </>
            ) : null}
            <button
              className="primary-action"
              type="button"
              disabled={!displayName.trim() || actionKey === "create"}
              onClick={() =>
                void doPhoneAction(
                  "create",
                  async () => {
                    await api.createPhone({
                      adapterType: "clario_gateway",
                      displayName,
                      providerInstanceId: `wa-${Math.random().toString(36).slice(2, 8)}`,
                      ...(phoneNumber.trim()
                        ? { phoneNumber: phoneNumber.trim() }
                        : {}),
                      ...(gatewayBaseUrl.trim()
                        ? { gatewayBaseUrl: gatewayBaseUrl.trim() }
                        : {}),
                      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
                    });
                    onChanged();
                  },
                  "Number added",
                )
              }
            >
              {actionKey === "create" ? "Adding..." : "Add number"}
            </button>
          </div>
          {additionalPhones.length > 0 ||
          hiddenDevPhones.length > 0 ||
          legacyPhones.length > 0 ? (
            <div className="phone-secondary-list">
              {additionalPhones.map((phone) => (
                <article className="phone-secondary-row" key={phone.id}>
                  <div>
                    <strong>{phone.displayName}</strong>
                    <span>
                      {phone.phoneNumber ??
                        phone.providerInstanceId ??
                        "No number yet"}
                    </span>
                  </div>
                  <em>{phone.status}</em>
                </article>
              ))}
              {hiddenDevPhones.length > 0 ? (
                <span>
                  {hiddenDevPhones.length} test route
                  {hiddenDevPhones.length === 1 ? "" : "s"} hidden from the main
                  view.
                </span>
              ) : null}
              {legacyPhones.length > 0 ? (
                <span>
                  {legacyPhones.length} legacy route
                  {legacyPhones.length === 1 ? "" : "s"} hidden from Core v1.
                </span>
              ) : null}
            </div>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}
