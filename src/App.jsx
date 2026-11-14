import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  Search,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react";
import "./App.css";

const DATA_FILES = [
  "accounts-export.json",
  "kestrel-estates.json",
  "account-a-paperwork.json",
  "account-b-paperwork.json",
  "signals.json",
  "flytbase-team.json",
  "notes.json",
  "feature-requests.json",
  "release-notes.json",
];

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "opportunities", label: "Opportunities", icon: Building2 },
  { id: "people", label: "Stakeholders", icon: Users },
  { id: "evidence", label: "Evidence library", icon: FileText },
  { id: "signals", label: "Live Signals & Notes", icon: Bell },
];

function unwrap(file) {
  if (file?.result?.content?.[0]?.text) {
    try {
      return JSON.parse(file.result.content[0].text);
    } catch {
      return {};
    }
  }

  return file ?? {};
}

function money(value, accountId) {
  if (value == null || Number.isNaN(Number(value))) {
    return "Not available";
  }

  const currencies = {
    A: "GBP",
    B: "EUR",
    K: "USD",
  };

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currencies[accountId] || "USD",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function shortDate(value) {
  if (!value) return "Date not recorded";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function statusClass(status = "") {
  const value = String(status).toLowerCase();

  if (
    ["won", "verified", "available", "agreed", "closed"].includes(value)
  ) {
    return "status-good";
  }

  if (["declined", "passed", "open", "new"].includes(value)) {
    return "status-warning";
  }

  return "status-neutral";
}

// Existing account recommendations plus evidence-driven recommendations.
function buildNextMoves(account) {
  if (account?.id === "A") {
    return [
      {
        title: "Get the data-flow pack to Tarn Valley",
        detail:
          "Engineering can prepare the pack in a week. The DPO needs it before signing the DPIA.",
        priority: "Urgent",
        owner: "Customer Success + Engineering",
        deadline: "Before the DPIA can be signed",
        deal: "Tarn Valley and Norwold go live",
      },
      {
        title: "Build a cost-per-flight comparison",
        detail:
          "Ask Ewan to calculate drone operator overtime against the approximately £1,500 helicopter-hour cost.",
        priority: "High",
        owner: "Ewan Brooks + Customer Success",
        deadline: "Before the finance bid window",
        deal: "Scale Westmere's fleet",
      },
      {
        title: "Put a costed operating model into the tender",
        detail:
          "Confirm staffing, finance sign-off and which forces will operate the proposed 300 docks.",
        priority: "High",
        owner: "Rhys Calder + Finance",
        deadline: "Before the tender specification locks",
        deal: "300-dock framework tender",
      },
    ];
  }

  if (account?.id === "B") {
    return [
      {
        title: "Document the deputy's rollout knowledge",
        detail:
          "Capture the rollout template, plant contacts, operator training and site setup before the deputy leaves.",
        priority: "Urgent",
        owner: "Stefan Roy + Customer Success",
        deadline: "Before the deputy leaves",
        deal: "Idle plant rollout",
      },
      {
        title: "Agree Plant 7 alert-response ownership",
        detail:
          "The guard contractor's current contract excludes drone alerts. Agree who responds and update the process.",
        priority: "High",
        owner: "Beatriz Alonso + Stefan Roy",
        deadline: "Before expanding night patrols",
        deal: "Aldermoor contract renewal",
      },
      {
        title: "Prepare for the network segmentation project",
        detail:
          "Work with Owen to plan exceptions before the project starts in four months.",
        priority: "High",
        owner: "Owen Fitch + Solutions Engineering",
        deadline: "Before network segmentation starts",
        deal: "Idle plant rollout",
      },
    ];
  }

  const facts = account?.facts ?? [];
  const opportunities = account?.opportunities ?? [];

  const hasFact = (...words) =>
    facts.some((fact) => {
      const text = `${fact.text || ""} ${fact.id || ""}`.toLowerCase();
      return words.some((word) => text.includes(word));
    });

  const moves = [];

  if (
    hasFact("certified pilot", "no pilot", "test flight", "commissioned")
  ) {
    moves.push({
      title: "Resolve pilot coverage and commissioning",
      detail:
        "Confirm who can legally operate the system, assess the proposed training, and arrange a documented commissioning test flight.",
      priority: "Urgent",
      owner: "Account owner + Customer Success",
      deadline: "Before go-live",
      deal: opportunities[0]?.title || "Operational go-live",
    });
  }

  if (
    hasFact("insurer", "insurance", "not declared", "not notified")
  ) {
    moves.push({
      title: "Obtain insurer notification and clearance",
      detail:
        "Contact the insurance representative, disclose the equipment and intended operation, and confirm requirements in writing before use.",
      priority: "Urgent",
      owner: "Account owner + Insurance contact",
      deadline: "Before equipment is used",
      deal: opportunities[0]?.title || "Operational go-live",
    });
  }

  if (
    hasFact("board vote", "board meeting", "security budget", "residents")
  ) {
    moves.push({
      title: "Prepare a decision-ready board proposal",
      detail:
        "Set out the operational plan, remaining costs, responsibilities and evidence needed for the board's decision.",
      priority: "High",
      owner: "Account owner + Decision-maker",
      deadline: "Before the next board meeting",
      deal: opportunities[0]?.title || "Account renewal",
    });
  }

  for (const opportunity of opportunities) {
    if (moves.length >= 3) break;

    if (moves.some((move) => move.deal === opportunity.title)) continue;

    moves.push({
      title: `Resolve blocker: ${opportunity.title}`,
      detail:
        opportunity.blocker?.text ||
        "Confirm the outstanding requirements and agree the next customer action.",
      priority: opportunity.deadline?.soon ? "Urgent" : "High",
      owner: "Account owner + relevant stakeholder",
      deadline: opportunity.deadline?.text || "Confirm with account owner",
      deal: opportunity.title,
    });
  }

  return moves.slice(0, 3);
}

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeAccount, setActiveAccount] = useState("A");
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");

  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteKind, setNoteKind] = useState("note");
  const [noteStatus, setNoteStatus] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const navigate = (tab) => {
    setActiveTab(tab);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // SAVE NOTES THROUGH MCP
  async function saveNote(event) {
    event.preventDefault();

    if (!noteText.trim()) {
      setNoteStatus("Please enter some note text.");
      return;
    }

    setSavingNote(true);
    setNoteStatus("");

    try {
      const response = await fetch("/api/tool/write_note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          arguments: {
            account: activeAccount,
            title: noteTitle.trim() || "CRM update",
            text: noteText.trim(),
            kind: noteKind,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.connected || result.result?.isError) {
        throw new Error(
          result.result?.content?.[0]?.text ||
            result.error ||
            "MCP could not save the note."
        );
      }

      setNoteStatus("Note successfully saved to the assignment!");
      setNoteTitle("");
      setNoteText("");
      setNoteKind("note");
    } catch (err) {
      setNoteStatus(`Could not save note: ${err.message}`);
    } finally {
      setSavingNote(false);
    }
  }

  // LOAD ACCOUNT DATA AND LIVE SIGNALS
  useEffect(() => {
    let isMounted = true;
    let requestInProgress = false;

    async function loadData() {
      try {
        const responses = await Promise.all(
          DATA_FILES.map(async (file) => {
            const response = await fetch(`/data/${file}`);

            if (!response.ok) {
              throw new Error(`Could not load ${file}`);
            }

            return [file, await response.json()];
          })
        );

        const files = Object.fromEntries(responses);

        const exportData = unwrap(files["accounts-export.json"]);
        const kestrelData = unwrap(files["kestrel-estates.json"]);

        if (!Array.isArray(exportData.accounts)) {
          throw new Error(
            "The account export does not contain an accounts array."
          );
        }

        const existingIds = new Set(
          exportData.accounts.map((account) => account.id)
        );

        const additionalAccounts = (
          kestrelData.accounts ?? []
        ).filter((account) => !existingIds.has(account.id));

        const accounts = [
          ...exportData.accounts,
          ...additionalAccounts,
        ];

        const existingFileIds = new Set(
          (exportData.files ?? []).map((file) => file.id)
        );

        const additionalFiles = (
          kestrelData.files ?? []
        ).filter((file) => !existingFileIds.has(file.id));

        const allFiles = [
          ...(exportData.files ?? []),
          ...additionalFiles,
        ];

        if (!isMounted) return;

        setData({
          accounts,
          files: allFiles,
          paperworkA: unwrap(files["account-a-paperwork.json"]),
          paperworkB: unwrap(files["account-b-paperwork.json"]),
          signals: unwrap(files["signals.json"]),
          team: unwrap(files["flytbase-team.json"]),
          notes: unwrap(files["notes.json"]),
          featureRequests: unwrap(files["feature-requests.json"]),
          releaseNotes: unwrap(files["release-notes.json"]),
          exportedAt: exportData.exported_at,
          minute: exportData.minute,
          worldClosed: exportData.world_closed,
        });
      } catch (err) {
        if (isMounted) {
          setError(
            err.message ||
              "Something went wrong while loading the CRM data."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    async function refreshSignals() {
      if (!isMounted || requestInProgress) return;

      requestInProgress = true;

      try {
        const response = await fetch("/api/tool/get_signals", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            arguments: {},
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const result = await response.json();

        if (!result.connected) {
          throw new Error("MCP connection failed.");
        }

        const liveData = unwrap(result);

        if (
          result.result?.isError ||
          !Array.isArray(liveData.signals)
        ) {
          console.error(
            "MCP signal error:",
            liveData.error ||
              result.result?.content?.[0]?.text ||
              "Invalid signals response."
          );
          return;
        }

        if (isMounted) {
          setData((previousData) => {
            if (!previousData) return previousData;

            return {
              ...previousData,
              signals: liveData,
            };
          });

          console.log(
            "Live signals updated successfully:",
            liveData.signals
          );
        }
      } catch (err) {
        console.error(
          "Live signal update failed:",
          err.message
        );
      } finally {
        requestInProgress = false;
      }
    }

    // Load account data before fetching the first live signal response.
    loadData().then(() => {
      refreshSignals();
    });

    // Refresh live signals every 60 seconds.
    const signalInterval = setInterval(refreshSignals, 60000);

    return () => {
      isMounted = false;
      clearInterval(signalInterval);
    };
  }, []);

  const account = useMemo(
    () => data?.accounts.find((item) => item.id === activeAccount),
    [data, activeAccount]
  );

  const paperwork = useMemo(() => {
    if (!data) return [];

    if (activeAccount === "A") {
      return data.paperworkA.records ?? [];
    }

    if (activeAccount === "B") {
      return data.paperworkB.records ?? [];
    }

    return data.files
      .filter((file) => file.account === activeAccount)
      .map((file) => ({
        path: file.path,
        kind: "Supporting file",
        text:
          "This file is listed in the account export. Its original contents have not been loaded into this dashboard.",
      }));
  }, [data, activeAccount]);

  const allFacts = account?.facts ?? [];
  const stakeholders = account?.stakeholders ?? [];
  const opportunities = account?.opportunities ?? [];
  const offers = account?.offers ?? [];
  const deadlines = account?.deadlines ?? [];

  const evidenceFor = (id) => {
    const fact = allFacts.find((item) => item.id === id);

    if (fact) {
      return {
        id,
        title: fact.text,
        source: fact.said_by || "Account fact",
        kind: fact.status || "recorded",
      };
    }

    const file = data?.files?.find(
      (item) => item.id === id && item.account === activeAccount
    );

    if (file) {
      return {
        id,
        title: file.title,
        source: file.path,
        kind: "Supporting file",
      };
    }

    const record = paperwork.find(
      (item) => item.path === id || item.path?.includes(id)
    );

    if (record) {
      return {
        id,
        title: record.path,
        source: record.kind || "Paperwork record",
        kind: "Paperwork",
      };
    }

    return {
      id,
      title: "Source reference in account export",
      source: "Open the original account records to verify",
      kind: "Reference",
    };
  };

  const filteredFacts = allFacts.filter((fact) => {
    const query = search.toLowerCase();

    return (
      !query ||
      fact.text?.toLowerCase().includes(query) ||
      fact.said_by?.toLowerCase().includes(query) ||
      fact.id?.toLowerCase().includes(query)
    );
  });

  const nextMoves = buildNextMoves(account);

  if (loading) {
    return (
      <div className="loading-screen">
        <LoaderCircle className="spin" size={34} />
        <h2>Loading FlytBase CRM</h2>
        <p>Reading your account data and supporting records...</p>
      </div>
    );
  }

  if (error || !data || !account) {
    return (
      <div className="loading-screen">
        <AlertTriangle size={36} />
        <h2>Unable to load CRM data</h2>
        <p>{error || "Account data is missing."}</p>
        <button
          className="primary-button"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  }

  const liveSignals = Array.isArray(data.signals?.signals)
    ? data.signals.signals
    : [];

  const accountSignals = liveSignals.filter(
    (signal) => signal.account === activeAccount
  );

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <strong>flytbase</strong>
            <span>ACCOUNT INTELLIGENCE</span>
          </div>
        </div>

        <div className="side-label">WORKSPACE</div>

        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`side-link ${
              activeTab === id ? "active" : ""
            }`}
            onClick={() => navigate(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}

        <div className="sidebar-bottom">
          <div className="connection-card">
            <span className="connection-dot" />
            <div>
              <strong>Account data loaded</strong>
              <small>{data.accounts.length} accounts available</small>
            </div>
          </div>
          <small className="sidebar-foot">
            PRIVATE CRM WORKSPACE
          </small>
        </div>
      </aside>

      {/* MAIN PAGE */}
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            Accounts <ChevronRight size={14} />
            {NAV_ITEMS.find((item) => item.id === activeTab)?.label}
          </div>

          <div className="topbar-right">
            <span className="live-label">
              <span /> DATA SNAPSHOT
            </span>
            <button
              type="button"
              className="icon-button"
              title="Notifications"
            >
              <Bell size={18} />
            </button>
            <div className="avatar">CS</div>
          </div>
        </header>

        <div className="page-content">
          {/* PAGE HEADING */}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                CUSTOMER SUCCESS / ACCOUNT REVIEW
              </div>

              <h1>
                {activeTab === "overview"
                  ? "Account command centre"
                  : activeTab === "opportunities"
                    ? "Opportunities"
                    : activeTab === "people"
                      ? "Stakeholder power map"
                      : activeTab === "signals"
                        ? "Live Signals & Notes"
                        : "Evidence library"}
              </h1>

              <p>
                {activeTab === "overview"
                  ? "Commercial position, customer relationships and the next moves."
                  : activeTab === "opportunities"
                    ? "Review potential opportunities, blockers and source evidence."
                    : activeTab === "people"
                      ? "Understand customer relationships and stakeholder availability."
                      : activeTab === "signals"
                        ? "Monitor incoming account events and save notes, risks and next steps."
                        : "Explore recorded account facts and supporting paperwork."}
              </p>
            </div>

            <div className="export-info">
              <span>Exported</span>
              <strong>{shortDate(data.exportedAt)}</strong>
            </div>
          </div>

          {/* ACCOUNT SELECTOR */}
          <section className="account-switcher">
            {data.accounts.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`account-option ${
                  activeAccount === item.id ? "selected" : ""
                }`}
                onClick={() => {
                  setActiveAccount(item.id);
                  setSearch("");
                  setNoteStatus("");
                }}
              >
                <span
                  className={`account-icon account-${String(
                    item.id
                  ).toLowerCase()}`}
                >
                  <Building2 size={20} />
                </span>

                <span className="account-option-text">
                  <strong>{item.name}</strong>
                  <small>Account {item.id}</small>
                </span>

                {activeAccount === item.id && (
                  <CheckCircle2 size={19} />
                )}
              </button>
            ))}
          </section>

          {/* OVERVIEW PAGE */}
          {activeTab === "overview" && (
            <>
              <section className="account-intro">
                <div>
                  <div className="eyebrow">
                    ACCOUNT {account.id}
                  </div>
                  <h2>{account.name}</h2>
                  <p>{account.official_story}</p>
                </div>

                <span className="snapshot-pill">
                  <Activity size={14} /> Account snapshot
                </span>
              </section>

              <section className="metric-grid">
                <div className="metric-card">
                  <div className="metric-top">
                    <span>Potential opportunity value</span>
                    <Building2 size={17} />
                  </div>

                  <strong>
                    {money(
                      opportunities.reduce(
                        (sum, item) =>
                          sum + (Number(item.worth_up_to) || 0),
                        0
                      ),
                      activeAccount
                    )}
                  </strong>

                  <small>
                    Sum of qualified opportunity ceilings; not committed revenue
                  </small>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span>Open opportunities</span>
                    <Activity size={17} />
                  </div>

                  <strong>
                    {
                      opportunities.filter(
                        (item) => item.blocker?.status === "open"
                      ).length
                    }
                  </strong>

                  <small>
                    Of {opportunities.length} recorded opportunities
                  </small>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span>Stakeholders</span>
                    <Users size={17} />
                  </div>

                  <strong>{stakeholders.length}</strong>

                  <small>
                    People recorded in the account map
                  </small>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span>Passed deadlines</span>
                    <AlertTriangle size={17} />
                  </div>

                  <strong>
                    {deadlines.filter((item) => item.passed).length}
                  </strong>

                  <small>
                    Deadlines marked as passed in the export
                  </small>
                </div>
              </section>

              <div className="dashboard-grid">
                <section className="panel main-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>First three moves</h3>
                      <p>
                        Recommended actions based on the account evidence
                      </p>
                    </div>

                    <span className="panel-icon">
                      <Activity size={18} />
                    </span>
                  </div>

                  <div className="move-list">
                    {nextMoves.map((move, index) => (
                      <div className="move-item" key={move.title}>
                        <div className="move-number">
                          {String(index + 1).padStart(2, "0")}
                        </div>

                        <div className="move-content">
                          <div className="move-title-row">
                            <strong>{move.title}</strong>
                            <span className="priority-pill">
                              {move.priority}
                            </span>
                          </div>

                          <p>{move.detail}</p>
                          <small>Owner: {move.owner}</small>
                          {move.deadline && (
                            <small>Target: {move.deadline}</small>
                          )}
                          {move.deal && (
                            <small>Deal: {move.deal}</small>
                          )}
                        </div>
                      </div>
                    ))}

                    {nextMoves.length === 0 && (
                      <p className="empty-state">
                        No recommended moves are available from the current
                        account records.
                      </p>
                    )}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Risks & deadlines</h3>
                      <p>Items requiring attention</p>
                    </div>

                    <ShieldAlert size={19} />
                  </div>

                  <div className="deadline-list">
                    {deadlines.map((item, index) => (
                      <div
                        className="deadline-item"
                        key={`${item.text}-${index}`}
                      >
                        {item.passed ? (
                          <XCircle
                            className="deadline-icon danger"
                            size={19}
                          />
                        ) : (
                          <Clock3
                            className="deadline-icon warning"
                            size={19}
                          />
                        )}

                        <div>
                          <p>{item.text}</p>
                          <span
                            className={
                              item.passed
                                ? "status-warning"
                                : "status-neutral"
                            }
                          >
                            {item.passed
                              ? "Passed"
                              : "Not marked as passed"}
                          </span>
                        </div>
                      </div>
                    ))}

                    {deadlines.length === 0 && (
                      <p className="empty-state">
                        No deadlines recorded.
                      </p>
                    )}
                  </div>

                  <div className="risk-note">
                    <AlertTriangle size={16} />
                    A passed deadline is not automatically evidence of a lost
                    deal. Confirm the current position with its owner.
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Opportunity pipeline</h3>
                      <p>Potential value by opportunity</p>
                    </div>

                    <ArrowRight size={18} />
                  </div>

                  <div className="compact-list">
                    {opportunities.map((item) => (
                      <div className="compact-item" key={item.id}>
                        <div>
                          <strong>{item.title}</strong>
                          <small>
                            {item.stage} ·{" "}
                            {item.blocker?.status || "No blocker status"}
                          </small>
                        </div>

                        <b>
                          {money(item.worth_up_to, activeAccount)}
                        </b>
                      </div>
                    ))}

                    {opportunities.length === 0 && (
                      <p className="empty-state">
                        No opportunities recorded.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    className="text-button"
                    onClick={() => navigate("opportunities")}
                  >
                    View all opportunities <ArrowRight size={15} />
                  </button>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Commercial offers</h3>
                      <p>Recorded offer outcomes</p>
                    </div>

                    <FileText size={18} />
                  </div>

                  <div className="compact-list">
                    {offers.map((offer) => (
                      <div className="compact-item" key={offer.id}>
                        <div>
                          <strong>{offer.title}</strong>
                          <small>
                            To: {offer.pitch_to || "Not recorded"}
                          </small>
                        </div>

                        <div className="offer-right">
                          <b>{money(offer.value, activeAccount)}</b>
                          <span className={statusClass(offer.status)}>
                            {offer.status}
                          </span>
                        </div>
                      </div>
                    ))}

                    {offers.length === 0 && (
                      <p className="empty-state">
                        No commercial offers recorded.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}

          {/* OPPORTUNITIES PAGE */}
          {activeTab === "opportunities" && (
            <section className="panel full-panel">
              <div className="panel-heading">
                <div>
                  <h3>Opportunity register</h3>
                  <p>
                    Each potential value is shown with its blocker and source
                    evidence.
                  </p>
                </div>

                <span className="count-pill">
                  {opportunities.length} opportunities
                </span>
              </div>

              <div className="opportunity-list">
                {opportunities.map((item) => (
                  <article className="opportunity-card" key={item.id}>
                    <div className="opportunity-top">
                      <div>
                        <span className="eyebrow">
                          {item.id} · {item.stage}
                        </span>
                        <h4>{item.title}</h4>
                      </div>

                      <strong className="opportunity-value">
                        {money(item.worth_up_to, activeAccount)}
                      </strong>
                    </div>

                    <div className="blocker-box">
                      <AlertTriangle size={17} />
                      <div>
                        <b>Current blocker</b>
                        <p>
                          {item.blocker?.text || "No blocker recorded."}
                        </p>
                      </div>
                    </div>

                    <div className="evidence-chips">
                      {(item.evidence ?? []).map((id) => {
                        const evidence = evidenceFor(id);

                        return (
                          <span
                            className="evidence-chip"
                            key={id}
                            title={`${evidence.source}: ${evidence.title}`}
                          >
                            <FileText size={12} /> {id}
                          </span>
                        );
                      })}
                    </div>

                    <small className="value-disclaimer">
                      Potential ceiling only — not booked or guaranteed revenue.
                    </small>
                  </article>
                ))}

                {opportunities.length === 0 && (
                  <p className="empty-state">
                    No opportunities recorded for this account.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* STAKEHOLDERS PAGE */}
          {activeTab === "people" && (
            <section className="panel full-panel">
              <div className="panel-heading">
                <div>
                  <h3>Stakeholder power map</h3>
                  <p>
                    Recorded customer relationships and availability.
                  </p>
                </div>

                <span className="count-pill">
                  {stakeholders.length} stakeholders
                </span>
              </div>

              <div className="stakeholder-grid">
                {stakeholders.map((person) => (
                  <article className="stakeholder-card" key={person.id}>
                    <div className="person-avatar">
                      {person.name
                        ?.split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </div>

                    <div className="person-details">
                      <h4>{person.name}</h4>
                      <p>{person.role}</p>

                      <div className="person-tags">
                        <span className={statusClass(person.relationship)}>
                          {person.relationship}
                        </span>

                        <span
                          className={
                            person.available
                              ? "status-good"
                              : "status-warning"
                          }
                        >
                          {person.available
                            ? "Available"
                            : "Unavailable"}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}

                {stakeholders.length === 0 && (
                  <p className="empty-state">
                    No stakeholders recorded.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* EVIDENCE PAGE */}
          {activeTab === "evidence" && (
            <div className="evidence-layout">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Known facts & information</h3>
                    <p>
                      Search account facts and see how each was recorded.
                    </p>
                  </div>

                  <Search size={18} />
                </div>

                <div className="search-box">
                  <Search size={16} />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search facts, people or IDs..."
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                    >
                      <XCircle size={15} />
                    </button>
                  )}
                </div>

                <div className="fact-list">
                  {filteredFacts.map((fact) => (
                    <article className="fact-item" key={fact.id}>
                      <div className="fact-top">
                        <span className="eyebrow">{fact.id}</span>

                        <span className={statusClass(fact.status)}>
                          {fact.status}
                        </span>
                      </div>

                      <p>{fact.text}</p>

                      <small>
                        {fact.said_by || "Source not recorded"} · Learned{" "}
                        {fact.learned_at_minute != null
                          ? `at minute ${fact.learned_at_minute}`
                          : "date not recorded"}
                      </small>
                    </article>
                  ))}

                  {filteredFacts.length === 0 && (
                    <p className="empty-state">
                      No facts match your search.
                    </p>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Supporting paperwork</h3>
                    <p>
                      Original account records and supporting file references.
                    </p>
                  </div>

                  <FileText size={18} />
                </div>

                <div className="paperwork-list">
                  {paperwork.map((record, index) => (
                    <details
                      className="paperwork-record"
                      key={`${record.path}-${index}`}
                    >
                      <summary>
                        <div>
                          <strong>{record.path}</strong>
                          <small>{record.kind || "Record"}</small>
                        </div>

                        <ChevronRight size={16} />
                      </summary>

                      <p>{record.text || "No extracted text available."}</p>
                    </details>
                  ))}

                  {paperwork.length === 0 && (
                    <p className="empty-state">
                      No supporting paperwork references are available.
                    </p>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* LIVE SIGNALS AND NOTES PAGE */}
          {activeTab === "signals" && (
            <div className="evidence-layout">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Incoming live events</h3>
                    <p>
                      Events retrieved directly from the MCP using
                      get_signals. Refreshes automatically every 60 seconds.
                    </p>
                  </div>
                  <Activity size={20} />
                </div>

                {accountSignals.map((signal) => (
                  <article className="fact-item" key={signal.id}>
                    <div className="fact-top">
                      <span className="eyebrow">{signal.id}</span>
                      <span className="status-warning">
                        {shortDate(signal.dated)}
                      </span>
                    </div>

                    <h4>{signal.title}</h4>
                    <p>{signal.summary}</p>

                    {(signal.records ?? []).map((record, index) => (
                      <p key={`${record.path}-${index}`}>
                        <small>
                          Source: {record.path}
                          {record.kind ? ` · ${record.kind}` : ""}
                        </small>
                      </p>
                    ))}
                  </article>
                ))}

                {accountSignals.length === 0 && (
                  <p className="empty-state">
                    No live events currently returned for this account.
                  </p>
                )}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>Write back to the account</h3>
                    <p>
                      Save a note, task, risk or next step through the MCP.
                    </p>
                  </div>
                  <FileText size={20} />
                </div>

                <form onSubmit={saveNote}>
                  <label htmlFor="note-account">Account</label>
                  <select
                    id="note-account"
                    value={activeAccount}
                    onChange={(event) => {
                      setActiveAccount(event.target.value);
                      setNoteStatus("");
                    }}
                  >
                    {data.accounts.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="note-kind">Record type</label>
                  <select
                    id="note-kind"
                    value={noteKind}
                    onChange={(event) => setNoteKind(event.target.value)}
                  >
                    <option value="note">Note</option>
                    <option value="task">Task</option>
                    <option value="risk">Risk</option>
                    <option value="next_step">Next step</option>
                  </select>

                  <label htmlFor="note-title">Title</label>
                  <input
                    id="note-title"
                    type="text"
                    value={noteTitle}
                    onChange={(event) => setNoteTitle(event.target.value)}
                    placeholder="Short title"
                    maxLength={150}
                  />

                  <label htmlFor="note-text">Note details</label>
                  <textarea
                    id="note-text"
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    placeholder="Write your account update..."
                    rows={5}
                    maxLength={4000}
                    required
                  />

                  <button
                    type="submit"
                    disabled={savingNote}
                    className="primary-button"
                  >
                    {savingNote ? "Saving..." : "Save through MCP"}
                  </button>

                  {noteStatus && (
                    <p role="status" className="empty-state">
                      {noteStatus}
                    </p>
                  )}
                </form>
              </section>
            </div>
          )}

          {/* FOOTER */}
          <footer className="page-footer">
            <span>
              FlytBase account intelligence · Assignment workspace
            </span>

            <span>
              {allFacts.length} facts · {paperwork.length} paperwork records ·{" "}
              {data.files.filter(
                (file) => file.account === activeAccount
              ).length}{" "}
              evidence files
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;