
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

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: accountId === "A" ? "GBP" : "EUR",
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

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeAccount, setActiveAccount] = useState("A");
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");

  const navigate = (tab) => {
    setActiveTab(tab);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // LOAD DATA AND CHECK LIVE MCP SIGNALS
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

        if (!Array.isArray(exportData.accounts)) {
          throw new Error(
            "The account export does not contain an accounts array."
          );
        }

        if (!isMounted) return;

        setData({
          accounts: exportData.accounts,
          files: exportData.files ?? [],
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
        const response = await fetch(
          "http://localhost:3001/api/tool/get_signals",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              arguments: {},
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const result = await response.json();

        if (!result.connected) {
          throw new Error("MCP connection failed.");
        }

        const liveData = unwrap(result);

        // Reject error responses without replacing existing data.
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

    loadData();

    // Check MCP for new signals every 60 seconds.
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

    return activeAccount === "A"
      ? data.paperworkA.records ?? []
      : data.paperworkB.records ?? [];
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

  const nextMoves =
    activeAccount === "A"
      ? [
          {
            title: "Get the data-flow pack to Tarn Valley",
            detail:
              "Engineering can prepare the pack in a week. The DPO needs it before signing the DPIA.",
            priority: "Urgent",
            owner: "Customer Success + Engineering",
          },
          {
            title: "Build a cost-per-flight comparison",
            detail:
              "Ask Ewan to calculate drone operator overtime against the approximately £1,500 helicopter-hour cost.",
            priority: "High",
            owner: "Ewan Brooks + Customer Success",
          },
          {
            title: "Put a costed operating model into the tender",
            detail:
              "Confirm staffing, finance sign-off and which forces will operate the proposed 300 docks.",
            priority: "High",
            owner: "Rhys Calder + Finance",
          },
        ]
      : [
          {
            title: "Document the deputy's rollout knowledge",
            detail:
              "Capture the rollout template, plant contacts, operator training and site setup before the deputy leaves.",
            priority: "Urgent",
            owner: "Stefan Roy + Customer Success",
          },
          {
            title: "Agree Plant 7 alert-response ownership",
            detail:
              "The guard contractor's current contract excludes drone alerts. Agree who responds and update the process.",
            priority: "High",
            owner: "Beatriz Alonso + Stefan Roy",
          },
          {
            title: "Prepare for the network segmentation project",
            detail:
              "Work with Owen to plan exceptions before the project starts in four months.",
            priority: "High",
            owner: "Owen Fitch + Solutions Engineering",
          },
        ];

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
              <strong>Local data loaded</strong>
              <small>8 JSON files available</small>
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
                      : "Evidence library"}
              </h1>

              <p>
                {activeTab === "overview"
                  ? "Commercial position, customer relationships and the next moves."
                  : activeTab === "opportunities"
                    ? "Review potential opportunities, blockers and source evidence."
                    : activeTab === "people"
                      ? "Understand customer relationships and stakeholder availability."
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
                }}
              >
                <span
                  className={`account-icon account-${item.id.toLowerCase()}`}
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
                        </div>
                      </div>
                    ))}
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
                      Original account records from the export.
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

                      <p>{record.text}</p>
                    </details>
                  ))}
                </div>
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
