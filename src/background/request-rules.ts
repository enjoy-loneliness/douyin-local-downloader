const CDN_RULES = [
  { sessionId: 8101, downloadId: 8201, urlFilter: '||douyinvod.com', referer: 'https://www.douyin.com/' },
  { sessionId: 8102, downloadId: 8202, urlFilter: '||bytecdntp.com', referer: 'https://www.douyin.com/' },
  { sessionId: 8103, downloadId: 8203, urlFilter: '||douyinpic.com', referer: 'https://www.douyin.com/' },
  { sessionId: 8104, downloadId: 8204, urlFilter: '||byteimg.com', referer: 'https://www.douyin.com/' },
  { sessionId: 8105, downloadId: 8205, urlFilter: '||video.twimg.com', referer: 'https://x.com/' },
];

const SESSION_RULE_IDS = CDN_RULES.map((rule) => rule.sessionId);
const DOWNLOAD_RULE_IDS = CDN_RULES.map((rule) => rule.downloadId);

let rulesReady: Promise<void> | null = null;

function refererAction(value: string): chrome.declarativeNetRequest.RuleAction {
  return {
    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
    requestHeaders: [
      {
        header: 'Referer',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value,
      },
    ],
  };
}

function createSessionRules(): chrome.declarativeNetRequest.Rule[] {
  return CDN_RULES.map((rule) => ({
    id: rule.sessionId,
    priority: 1,
    action: refererAction(rule.referer),
    condition: {
      urlFilter: rule.urlFilter,
      // Only extension/service-worker initiated requests. Never rewrite requests
      // made by the platform tab itself because it already has the exact Referer.
      tabIds: [chrome.tabs.TAB_ID_NONE],
      resourceTypes: [
        chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
        chrome.declarativeNetRequest.ResourceType.MEDIA,
        chrome.declarativeNetRequest.ResourceType.OTHER,
      ],
    },
  }));
}

function createDownloadRules(): chrome.declarativeNetRequest.Rule[] {
  return CDN_RULES.map((rule) => ({
    id: rule.downloadId,
    priority: 1,
    action: refererAction(rule.referer),
    condition: {
      urlFilter: rule.urlFilter,
      // chrome.downloads requests are classified as OTHER and have no tab id.
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.OTHER],
    },
  }));
}

async function installRules(): Promise<void> {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: DOWNLOAD_RULE_IDS,
    addRules: createDownloadRules(),
  });
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: SESSION_RULE_IDS,
    addRules: createSessionRules(),
  });
}

export function ensureMediaRequestRules(): Promise<void> {
  rulesReady ??= installRules().catch((error: unknown) => {
    rulesReady = null;
    throw new Error(`无法配置媒体 CDN 下载请求：${error instanceof Error ? error.message : String(error)}`);
  });
  return rulesReady;
}
