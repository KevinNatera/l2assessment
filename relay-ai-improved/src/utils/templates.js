/**
 * Templates — action recommendations and routing metadata
 *
 * Changes from original:
 *  - Fixed "Feature Request" template which was a copy-paste of "Billing & Subscription"
 *    (was: "Ask user to check billing portal." — obviously wrong).
 *  - Added templates for all categories the LLM can now return.
 *  - shouldEscalate() now uses category + urgency as intended — not message.length > 100.
 *  - getAgentInfo() maps route_to values to display names/initials for the routing card.
 */

const ACTION_TEMPLATES = {
  'Technical Issue':
    'Reproduce the issue in a test environment, check recent deployment logs, and reply with a workaround or ETA within 2 hours.',
  'Billing & Subscription':
    'Pull the customer account, verify the charge or subscription state, and reply with a correction or explanation within 1 business day.',
  'Feature Request':
    'Log in the product backlog with customer context, send an acknowledgement, and follow up when the feature ships or is scoped.',
  'Account Management':
    'Verify customer identity, action the account change requested, and confirm completion by reply.',
  'General Inquiry':
    'Reply with the relevant FAQ link or a direct answer; escalate only if the question reveals an undocumented product gap.',
  'Positive Feedback':
    'Send a brief thank-you reply and flag the feedback to the Customer Success team for the monthly review.',
  'Spam / Other':
    'Mark as spam and close without reply. Flag if the volume of similar messages increases.',
};

const DEFAULT_ACTION = 'Review manually — no template matched this category.';

/**
 * Returns the recommended action string for a given category.
 * Urgency is accepted but currently used only by shouldEscalate.
 *
 * @param {string} category
 * @param {string} [urgency]
 * @returns {string}
 */
export function getRecommendedAction(category, urgency) {
  return ACTION_TEMPLATES[category] || DEFAULT_ACTION;
}

/**
 * Returns all known category names.
 * @returns {string[]}
 */
export function getAvailableCategories() {
  return Object.keys(ACTION_TEMPLATES);
}

/**
 * Determines whether a triage result should trigger an escalation alert.
 * Uses category + urgency — not message length.
 *
 * @param {string} category
 * @param {string} urgency
 * @returns {boolean}
 */
export function shouldEscalate(category, urgency) {
  if (urgency === 'Critical') return true;
  if (urgency === 'High' && category === 'Technical Issue') return true;
  return false;
}

/**
 * Maps route_to values to display metadata for the routing card UI.
 *
 * @param {string} routeTo
 * @returns {{ name: string, initials: string, role: string }}
 */
export function getAgentInfo(routeTo) {
  const AGENTS = {
    'Engineering On-Call': {
      name: 'Engineering On-Call',
      initials: 'EO',
      role: 'P1 escalation — immediate response',
    },
    'Technical Support': {
      name: 'Alex Chen',
      initials: 'AC',
      role: 'Senior Technical Support',
    },
    'Billing Team': {
      name: 'Maria Santos',
      initials: 'MS',
      role: 'Billing & Subscriptions',
    },
    'Product Team': {
      name: 'Jordan Park',
      initials: 'JP',
      role: 'Product Manager',
    },
    'Customer Success': {
      name: 'Sam Rivera',
      initials: 'SR',
      role: 'Customer Success',
    },
    'No Action Needed': {
      name: 'No Action Needed',
      initials: '—',
      role: 'Auto-close or acknowledge',
    },
  };
  return AGENTS[routeTo] || { name: routeTo, initials: '?', role: '' };
}
