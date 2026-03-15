import { useState, useEffect } from 'react';

/**
 * DashboardPage
 *
 * Fixes from original:
 *  - "Avg per day" no longer hardcodes division by 7.
 *    It now calculates the actual span from first to last message.
 *  - Added average confidence score metric card.
 *  - Urgency breakdown updated for 4-level scale: Critical/High/Medium/Low.
 *  - Routing breakdown section shows which teams are receiving the most tickets.
 *  - Insights section has more meaningful thresholds and messages.
 */

function DashboardPage() {
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    highCriticalPercent: 0,
    avgPerDay: 0,
    avgConfidence: null,
  });
  const [categoryData, setCategoryData] = useState([]);
  const [urgencyData, setUrgencyData] = useState({
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  });
  const [routingData, setRoutingData] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = () => {
    const history = JSON.parse(localStorage.getItem('triageHistory') || '[]');
    const today = new Date().toDateString();

    const todayMessages = history.filter(
      (item) => new Date(item.timestamp).toDateString() === today
    );

    // Fix: calculate actual day span instead of always dividing by 7
    let avgPerDay = 0;
    if (history.length > 0) {
      const timestamps = history.map((h) => new Date(h.timestamp).getTime());
      const spanMs = Math.max(...timestamps) - Math.min(...timestamps);
      const spanDays = Math.max(1, spanMs / (1000 * 60 * 60 * 24));
      avgPerDay = Math.round(history.length / spanDays);
    }

    const highOrCritical = history.filter(
      (h) => h.urgency === 'Critical' || h.urgency === 'High'
    ).length;

    // Average confidence (only for entries that have it)
    const withConfidence = history.filter((h) => h.confidence !== undefined);
    const avgConfidence =
      withConfidence.length > 0
        ? Math.round(
            withConfidence.reduce((sum, h) => sum + h.confidence, 0) /
              withConfidence.length
          )
        : null;

    setStats({
      total: history.length,
      today: todayMessages.length,
      highCriticalPercent:
        history.length > 0
          ? Math.round((highOrCritical / history.length) * 100)
          : 0,
      avgPerDay,
      avgConfidence,
    });

    // Category distribution
    const categories = {};
    history.forEach((item) => {
      categories[item.category] = (categories[item.category] || 0) + 1;
    });
    setCategoryData(
      Object.entries(categories)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
    );

    // Urgency breakdown (4-level)
    const urgency = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    history.forEach((item) => {
      if (urgency[item.urgency] !== undefined) {
        urgency[item.urgency]++;
      }
    });
    setUrgencyData(urgency);

    // Routing breakdown
    const routing = {};
    history.forEach((item) => {
      if (item.route_to) {
        routing[item.route_to] = (routing[item.route_to] || 0) + 1;
      }
    });
    setRoutingData(
      Object.entries(routing)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
    );
  };

  const URGENCY_COLORS = {
    Critical: { dot: 'bg-red-500', text: 'text-red-600' },
    High: { dot: 'bg-orange-500', text: 'text-orange-600' },
    Medium: { dot: 'bg-yellow-500', text: 'text-yellow-600' },
    Low: { dot: 'bg-green-500', text: 'text-green-600' },
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Triage analytics overview</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-5">
            <div className="text-sm text-gray-500 mb-1">Total messages</div>
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <div className="text-sm text-gray-500 mb-1">Today</div>
            <div className="text-3xl font-bold text-green-600">{stats.today}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <div className="text-sm text-gray-500 mb-1">High / Critical</div>
            <div className="text-3xl font-bold text-red-600">{stats.highCriticalPercent}%</div>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <div className="text-sm text-gray-500 mb-1">Avg / day</div>
            <div className="text-3xl font-bold text-purple-600">{stats.avgPerDay}</div>
          </div>
          {stats.avgConfidence !== null && (
            <div className="bg-white rounded-lg shadow p-5">
              <div className="text-sm text-gray-500 mb-1">Avg confidence</div>
              <div
                className={`text-3xl font-bold ${
                  stats.avgConfidence >= 80
                    ? 'text-green-600'
                    : stats.avgConfidence >= 55
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}
              >
                {stats.avgConfidence}%
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Category distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Category distribution</h2>
            {categoryData.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No data yet</div>
            ) : (
              <div className="space-y-3">
                {categoryData.map((cat) => {
                  const pct = stats.total > 0 ? (cat.count / stats.total) * 100 : 0;
                  return (
                    <div key={cat.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 truncate pr-2">{cat.name}</span>
                        <span className="text-gray-500 flex-shrink-0">
                          {cat.count} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Urgency breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Urgency breakdown</h2>
            {stats.total === 0 ? (
              <div className="text-center text-gray-400 py-8">No data yet</div>
            ) : (
              <div className="space-y-3">
                {Object.entries(URGENCY_COLORS).map(([level, colors]) => {
                  const count = urgencyData[level] || 0;
                  const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={level} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colors.dot}`} />
                      <span className="text-sm text-gray-700 w-16 flex-shrink-0">{level}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${colors.dot}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-sm font-semibold w-8 text-right ${colors.text}`}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Routing breakdown */}
        {routingData.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Routing distribution</h2>
            <div className="space-y-3">
              {routingData.map((r) => {
                const pct = stats.total > 0 ? (r.count / stats.total) * 100 : 0;
                return (
                  <div key={r.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{r.name}</span>
                      <span className="text-gray-500">
                        {r.count} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Insights */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-base font-bold text-blue-900 mb-3">Insights</h2>
          <div className="space-y-2 text-sm text-blue-800">
            {stats.total === 0 && (
              <p>👋 Start by analyzing some messages to see insights here.</p>
            )}
            {stats.highCriticalPercent > 30 && (
              <p>
                ⚠️ {stats.highCriticalPercent}% of messages are High or Critical urgency —
                consider adding support capacity.
              </p>
            )}
            {stats.today > 10 && (
              <p>📈 High activity today — {stats.today} messages analyzed.</p>
            )}
            {stats.avgConfidence !== null && stats.avgConfidence < 60 && (
              <p>
                🤔 Average AI confidence is {stats.avgConfidence}% — consider reviewing
                low-confidence results before routing.
              </p>
            )}
            {routingData[0] && stats.total > 4 && (
              <p>
                📬 {routingData[0].name} is handling the most tickets (
                {routingData[0].count} of {stats.total}).
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
