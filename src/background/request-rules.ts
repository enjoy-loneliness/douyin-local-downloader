const SESSION_RULE_IDS = [8101, 8102, 8103, 8104];
const DOWNLOAD_RULE_IDS = [8201, 8202, 8203, 8204];

const CDN_FILTERS = ['||douyinvod.com', '||bytecdntp.com', '||douyinpic.com', '||byteimg.com'];

let rulesReady: Promise<void> | null = null;

function refererAction(): chrome.declarativeNetRequest.RuleAction {
  return {
    type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
    requestHeaders: [
      {
        header: 'Referer',
        operation: chrome.declarativeNetRequest.HeaderOperation.SET,
        value: 'https://www.douyin.com/',
      },
    ],
  };
}

function createSessionRules(): chrome.declarativeNetRequest.Rule[] {
  return CDN_FILTERS.map((urlFilter, index) => ({
    id: SESSION_RULE_IDS[index],
    priority: 1,
    action: refererAction(),
    condition: {
      urlFilter,
      // Only extension/service-worker initiated requests. Never rewrite requests
      // made by the Douyin tab itself because it already has the exact Referer.
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
  return CDN_FILTERS.map((urlFilter, index) => ({
    id: DOWNLOAD_RULE_IDS[index],
    priority: 1,
    action: refererAction(),
    condition: {
      urlFilter,
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

export function ensureDouyinRequestRules(): Promise<void> {
  rulesReady ??= installRules().catch((error: unknown) => {
    rulesReady = null;
    throw new Error(`无法配置抖音 CDN 下载请求：${error instanceof Error ? error.message : String(error)}`);
  });
  return rulesReady;
}
