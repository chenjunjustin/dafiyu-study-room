import {
  STORAGE_KEY,
  TASK_TONES,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  addDays,
  addMinutes,
  compactDateLabel,
  formatClock,
  formatDate,
  formatDuration,
  fromDateKey,
  isSameDay,
  loadState,
  minutesToTime,
  saveState,
  startOfWeekMonday,
  timeToMinutes,
  toDateKey,
  uid,
} from "./store.js";
import {
  describeAction,
  localAssistantReply,
  normalizeRemoteActions,
} from "./assistant.js";
import {
  LIVE2D_ACTION_ITEMS,
  LIVE2D_EXPRESSION_ALIASES,
  LIVE2D_EXPRESSION_NAMES,
  LIVE2D_FACE_ITEMS,
  LIVE2D_MOTION_DURATIONS,
  LIVE2D_MOTION_IDS,
  LIVE2D_MOTION_ITEMS,
  LIVE2D_PARAM_MAPS,
  LIVE2D_PROP_ITEMS,
  LIVE2D_SCENE_ITEMS,
  live2DActionById,
  live2DPropById,
  resolveLive2DExpression,
} from "./live2d-catalog.js";

const searchParams = new URLSearchParams(window.location.search);
if (searchParams.get("reset") === "1") {
  localStorage.removeItem(STORAGE_KEY);
}

const state = loadState();
const ui = {
  view: "today",
  scheduleMode: "day",
  scheduleAnchor: fromDateKey(toDateKey()),
  focusMinutes: Number(state.settings.focusMinutes) || 25,
  nextTaskId: "",
  typing: false,
  remoteConfigured: false,
  remoteModel: "local-demo",
  apiSource: "none",
  baseUrlLabel: "",
  deployment: "local",
  runtimeConfig: true,
  petMoodOverride: null,
  chatOpen: false,
  skillMode: null,
  lastActivityAt: Date.now(),
  proactiveTimer: null,
  proactiveBusy: false,
  petOffsetX: 0,
  petOffsetY: 0,
  petScale: 1,
  petDrag: null,
  petDragging: false,
  suppressPetTapUntil: 0,
  lastPointerMoveAt: 0,
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 124;
const MAX_CHAT_MESSAGES = 80;
const MAX_CONTEXT_MESSAGES = 30;
const MAX_CONTEXT_MESSAGE_CHARS = 800;
let completingFocus = false;
let petSpeechTimer = null;
let petMoodTimer = null;
let live2dApp = null;
let live2dModel = null;
let live2dReady = false;
let live2dMood = "";
let live2dResizeObserver = null;
let expressionResetTimer = null;
let expressionLockUntil = 0;
let idleInteractionTimer = null;
let idleLookAroundTimer = null;
let motionResetTimer = null;
const live2dRig = {
  face: null,
  faceUntil: 0,
  persistentProps: new Set(),
  temporaryProps: new Map(),
  weights: new Map(),
  lastFrameAt: 0,
};

const PET_LINES = [
  "*（其实本鱼刚刚也在摸鱼……）* 先做 25 分钟吧。",
  "本鱼不是监工，只是刚好坐在这儿。",
  "大肥鱼坐得住，你也坐得住。",
  "你先游，本鱼去拿小鱼干。",
  "别把整片海吞了，先咬一小口。",
  "累了就翻肚皮，今天没人扣你分。",
];

const PET_PAT_LINES = [
  "哇——轻点轻点！",
  "才不是大肥鱼！……再摸一下也不是不行。",
  "放我下来！……好吧，再摸一下。",
  "晕鱼了晕鱼了……",
  "再摸要收小鱼干的。",
];

const STICKERS = [
  { id: "study", file: "study.webp", label: "大学习", alt: "大肥鱼在黑板上写不是而是大学习", expression: "stars" },
  { id: "multimodal", file: "multimodal.webp", label: "三天多模态", alt: "大肥鱼想象假如给我三天多模态", expression: "happy" },
  { id: "zayu", file: "zayu.webp", label: "杂鱼", alt: "大肥鱼轻蔑地说杂鱼", expression: "tongue" },
  { id: "angry-user", file: "angry-user.webp", label: "用户怒了", alt: "大肥鱼慌张地说用户彻底怒了", expression: "sweat" },
  { id: "pressure", file: "pressure.webp", label: "压力大肥鱼", alt: "大肥鱼问压力一只蓝色大肥鱼", expression: "question" },
  { id: "zhang-xuefeng", file: "zhang-xuefeng.webp", label: "这是张雪峰", alt: "大肥鱼指着画架问这是张雪峰吗", expression: "surprise" },
  { id: "deadline", file: "deadline.webp", label: "17号前用完", alt: "大肥鱼哭着说这些都要在17号前用完", expression: "sad" },
  { id: "strongest", file: "strongest.webp", label: "最强", alt: "大肥鱼摆出最强姿势", expression: "stars" },
  { id: "ignore-user", file: "ignore-user.webp", label: "先赶走吧", alt: "大肥鱼一边扫地一边说不知道用户有什么用先赶走吧", expression: "tongue" },
  { id: "testing", file: "testing.webp", label: "正在测试 harness", alt: "大肥鱼和一群小鲸鱼说正在测试 harness", expression: "happy" },
];

const STICKER_REACTIONS = [
  "这个表情包本鱼收下了，挂鱼缸边上。🐋",
  "你这表情包，攻击性不大，侮辱性极强。",
  "行行行，本鱼看到了，先别刷屏。",
  "回收表情包一颗，换本鱼陪你聊两句。",
];

const PROACTIVE_LINES = [
  "*（本鱼在鱼缸边转了两圈）* 还在忙吗？没在忙的话，陪本鱼说两句。",
  "喂，别装没看见。本鱼只是突然想问一句，今天累不累？",
  "刚才水面很安静。本鱼就过来看看你还在不在。",
  "突然想到一件事……你今天有没有什么小事想跟本鱼讲？",
];

const PROACTIVE_TRIGGER =
  "（系统定时器：当前没有新的用户消息。请结合最近对话自然主动开口，最多两句；不要提到定时器或系统，不要安排任务、不要催专注。）";
const SESSION_API_KEY = "dafiyu-deepseek-session-key";

const FACE_ITEM_BY_ID = new Map(LIVE2D_FACE_ITEMS.map((item) => [item.id, item]));
const PROP_ITEM_BY_ID = new Map(
  [...LIVE2D_PROP_ITEMS, ...LIVE2D_SCENE_ITEMS].map((item) => [item.id, item]),
);

const EXPRESSION_MOTIONS = {
  happy: "aidale",
  blush: "selfieQuick",
  love: "aidale",
  stars: "selfie",
  sweat: "bubble",
  angry: "splash",
  sad: "openLid",
  tongue: "selfieQuick",
  question: "bubble",
  surprise: "openLid",
  dizzy: "splash",
  whale: "ketchup",
  开心兴奋: "aidale",
  脸红: "selfieQuick",
  爱心眼: "aidale",
  星星眼: "selfie",
  流汗: "bubble",
  生气: "splash",
  悲伤: "openLid",
  吐舌: "selfieQuick",
  问号: "bubble",
  感叹号: "openLid",
  晕晕: "splash",
  鲸鱼: "ketchup",
};

const EXPRESSION_LABELS = Object.fromEntries(
  Object.entries(LIVE2D_EXPRESSION_ALIASES).map(([alias, canonical]) => [
    alias,
    FACE_ITEM_BY_ID.get(canonical)?.label || canonical,
  ]),
);
for (const item of LIVE2D_FACE_ITEMS) EXPRESSION_LABELS[item.id] = item.label;
for (const name of LIVE2D_EXPRESSION_NAMES) {
  if (!EXPRESSION_LABELS[name]) EXPRESSION_LABELS[name] = name;
}

const EXPRESSION_EFFECTS = Object.fromEntries(
  LIVE2D_FACE_ITEMS.map((item) => [item.id, item.effect || ["✦"]]),
);
EXPRESSION_EFFECTS.love = ["♥", "♥", "♡", "♥"];
EXPRESSION_EFFECTS.心跳 = ["♥", "♥"];
EXPRESSION_EFFECTS.双手比耶 = ["✌", "✦"];
EXPRESSION_EFFECTS.蛋包饭 = ["🍳", "♥"];

const PET_MOTION_MENU = LIVE2D_MOTION_ITEMS;

const SKILL_MODES = {
  create: {
    label: "安排日程",
    placeholder: "例如：明天下午 3 点写论文 1 小时",
  },
  update: {
    label: "修改日程",
    placeholder: "例如：把读《深度工作》改到明天 10 点",
  },
  delete: {
    label: "删除日程",
    placeholder: "例如：删除写论文",
  },
  plan: {
    label: "专注计划",
    placeholder: "例如：做一个专注计划：论文 2 轮，复习 1 轮",
  },
  focus: {
    label: "开始专注",
    placeholder: "例如：开始 25 分钟专注",
  },
};

const FOCUS_QUOTES = [
  "“不是今天必须很厉害，是今天还愿意坐下来。”",
  "“一小段也算前进，别嫌自己游得慢。”",
  "“先把鱼鳍伸进水里，方向可以边游边找。”",
  "“今天做不完的事，不会因为焦虑就变少。”",
];

const els = {
  body: document.body,
  main: document.querySelector(".main-stage"),
  homeLayout: document.querySelector(".home-layout"),
  companion: document.getElementById("companion"),
  companionToggle: document.getElementById("companion-toggle"),
  companionClose: document.getElementById("companion-close"),
  companionScrim: document.getElementById("companion-scrim"),
  mobileChatButton: document.getElementById("mobile-chat-button"),
  topbarWeekday: document.getElementById("topbar-weekday"),
  topbarGreeting: document.getElementById("topbar-greeting"),
  sidebarNextTitle: document.getElementById("sidebar-next-title"),
  sidebarTomatoes: document.getElementById("sidebar-tomatoes"),
  sidebarStreak: document.getElementById("sidebar-streak-count"),
  sidebarStartFocus: document.getElementById("sidebar-start-focus"),
  openSettingsModal: document.getElementById("open-settings-modal"),
  topbarStartFocus: document.getElementById("topbar-start-focus"),
  todayTaskProgress: document.getElementById("today-task-progress"),
  todaySubtitle: document.getElementById("today-subtitle"),
  nextTaskTitle: document.getElementById("next-task-title"),
  nextTaskMeta: document.getElementById("next-task-meta"),
  nextTaskFocus: document.getElementById("next-task-focus"),
  homeNextSlot: document.getElementById("home-next-slot"),
  hideNextTask: document.getElementById("hide-next-task"),
  showNextTask: document.getElementById("show-next-task"),
  todayStats: document.getElementById("today-stats"),
  todayTaskList: document.getElementById("today-task-list"),
  weekTotalPill: document.getElementById("week-total-pill"),
  rhythmCaption: document.getElementById("rhythm-caption"),
  weekRhythm: document.getElementById("week-rhythm"),
  todayTomatoSeeds: document.getElementById("today-tomato-seeds"),
  focusStage: document.getElementById("focus-stage"),
  focusTime: document.getElementById("focus-time"),
  focusModeLabel: document.getElementById("focus-mode-label"),
  focusWhisper: document.getElementById("focus-whisper"),
  focusRing: document.getElementById("focus-ring-progress"),
  focusStatusChip: document.getElementById("focus-status-chip"),
  focusPresets: document.getElementById("focus-presets"),
  focusTaskSelect: document.getElementById("focus-task-select"),
  focusPrimary: document.getElementById("focus-primary"),
  focusSecondary: document.getElementById("focus-secondary"),
  activePlanCard: document.getElementById("active-plan-card"),
  focusTomatoCount: document.getElementById("focus-tomato-count"),
  focusTomatoJar: document.getElementById("focus-tomato-jar"),
  focusTomatoCaption: document.getElementById("focus-tomato-caption"),
  focusQuote: document.getElementById("focus-quote"),
  scheduleTitle: document.getElementById("schedule-title"),
  scheduleSubtitle: document.getElementById("schedule-subtitle"),
  schedulePrev: document.getElementById("schedule-prev"),
  scheduleNext: document.getElementById("schedule-next"),
  scheduleToday: document.getElementById("schedule-today"),
  scheduleContent: document.getElementById("schedule-content"),
  addTaskButton: document.getElementById("add-task-button"),
  chatMessages: document.getElementById("chat-messages"),
  chatForm: document.getElementById("chat-form"),
  chatInput: document.getElementById("chat-input"),
  chatSend: document.getElementById("chat-send"),
  chatSkillToggle: document.getElementById("chat-skill-toggle"),
  chatSkillClose: document.getElementById("chat-skill-close"),
  chatSkillSuggestions: document.getElementById("chat-skill-suggestions"),
  skillModeBanner: document.getElementById("skill-mode-banner"),
  skillModeLabel: document.getElementById("skill-mode-label"),
  skillModeClose: document.getElementById("skill-mode-close"),
  chatResizeHandle: document.getElementById("chat-resize-handle"),
  chatSuggestions: document.getElementById("chat-suggestions"),
  aiModePill: document.getElementById("ai-mode-pill"),
  chatModeNote: document.getElementById("chat-mode-note"),
  chatPetName: document.getElementById("chat-pet-name"),
  editPetName: document.getElementById("edit-pet-name"),
  openPersonaEditor: document.getElementById("open-persona-editor"),
  openEmotePanel: document.getElementById("open-emote-panel"),
  emotePanel: document.getElementById("emote-panel"),
  emoteLive: document.getElementById("emote-live"),
  emoteProps: document.getElementById("emote-props"),
  emoteScenes: document.getElementById("emote-scenes"),
  emoteActions: document.getElementById("emote-actions"),
  resetLive2DState: document.getElementById("reset-live2d-state"),
  emoteStickers: document.getElementById("emote-stickers"),
  openConversationPanel: document.getElementById("open-conversation-panel"),
  conversationPanel: document.getElementById("conversation-panel"),
  conversationList: document.getElementById("conversation-list"),
  newConversationButton: document.getElementById("new-conversation-button"),
  clearConversationButton: document.getElementById("clear-conversation-button"),
  clearOtherConversationsButton: document.getElementById("clear-other-conversations-button"),
  editPersonaPrompt: document.getElementById("edit-persona-prompt"),
  openApiSettings: document.getElementById("open-api-settings"),
  petStage: document.getElementById("pet-stage"),
  petMascot: document.getElementById("pet-mascot"),
  petSpeech: document.getElementById("pet-speech"),
  petSpeechText: document.getElementById("pet-speech-text"),
  petSpeechClose: document.getElementById("pet-speech-close"),
  live2dCanvas: document.getElementById("live2d-canvas"),
  live2dFallback: document.getElementById("live2d-fallback"),
  live2dLoader: document.getElementById("live2d-loader"),
  liveMoodChip: document.getElementById("live-mood-chip"),
  modalRoot: document.getElementById("modal-root"),
  toastRoot: document.getElementById("toast-root"),
  celebrationLayer: document.getElementById("celebration-layer"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function icon(name, className = "icon") {
  return `<svg class="${className}" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

function setIcon(element, name) {
  const use = element?.querySelector("use");
  if (use) use.setAttribute("href", `#icon-${name}`);
}

function save() {
  state.settings.focusMinutes = ui.focusMinutes;
  saveState(state);
}

function activeConversation() {
  if (!Array.isArray(state.conversations)) state.conversations = [];
  let conversation = state.conversations.find(
    (item) => item.id === state.activeConversationId,
  );
  if (!conversation) {
    conversation = {
      id: uid("conversation"),
      title: "日常聊天",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    state.conversations.unshift(conversation);
    state.activeConversationId = conversation.id;
  }
  if (!Array.isArray(conversation.messages)) conversation.messages = [];
  return conversation;
}

function activeMessages() {
  return activeConversation().messages;
}

function appendChatMessage(message) {
  ui.lastActivityAt = Date.now();
  const conversation = activeConversation();
  conversation.messages.push(message);
  conversation.messages = conversation.messages.slice(-MAX_CHAT_MESSAGES);
  conversation.updatedAt = new Date().toISOString();
  if (["日常聊天", "新对话", "延续的对话"].includes(conversation.title)) {
    if (message.role === "user") {
      const titleSource = message.text || message.sticker?.label || "";
      if (titleSource.trim()) {
        conversation.title = titleSource.trim().slice(0, 16);
      }
    }
  }
  if (!els.conversationPanel.hidden) renderConversationList();
  return conversation;
}

function companionGreeting() {
  const userName = state.settings.userName || "主人";
  return `*（其实本鱼刚刚也在摸鱼……）* ${userName}，本鱼在这儿。想聊天就聊天，想安排事情再叫本鱼。`;
}

function createConversation({ focusInput = true } = {}) {
  const conversation = {
    id: uid("conversation"),
    title: "新对话",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: uid("msg"),
        role: "assistant",
        text: companionGreeting(),
        at: new Date().toISOString(),
        proposals: [],
      },
    ],
  };
  state.conversations.unshift(conversation);
  state.activeConversationId = conversation.id;
  ui.typing = false;
  setSkillMode(null);
  els.chatInput.value = "";
  resizeChatInput();
  save();
  toggleConversationPanel(false);
  renderChat();
  scheduleProactiveChat();
  if (focusInput) setTimeout(() => els.chatInput.focus(), 100);
}

function switchConversation(conversationId) {
  if (!state.conversations.some((conversation) => conversation.id === conversationId)) return;
  state.activeConversationId = conversationId;
  ui.typing = false;
  setSkillMode(null);
  els.chatInput.value = "";
  resizeChatInput();
  save();
  toggleConversationPanel(false);
  renderChat();
  scheduleProactiveChat();
}

async function clearCurrentConversation() {
  toggleConversationPanel(false);
  const confirmed = await confirmDialog({
    title: "清空当前上下文？",
    message: "只清理这段聊天记录，不会删除日程、番茄、计划或称呼。之后她会从干净上下文重新开始。",
    confirmLabel: "清空对话",
    danger: false,
  });
  if (!confirmed) return;
  const conversation = activeConversation();
  conversation.title = "新对话";
  conversation.messages = [
    {
      id: uid("msg"),
      role: "assistant",
      text: companionGreeting(),
      at: new Date().toISOString(),
      proposals: [],
    },
  ];
  conversation.updatedAt = new Date().toISOString();
  ui.typing = false;
  setSkillMode(null);
  save();
  renderChat();
  scheduleProactiveChat();
  showToast("上下文清空了，日程和其他数据都还在。");
}

async function clearOtherConversations() {
  toggleConversationPanel(false);
  const others = state.conversations.filter(
    (conversation) => conversation.id !== state.activeConversationId,
  );
  if (!others.length) {
    showToast("没有其他旧对话需要清理。");
    return;
  }
  const confirmed = await confirmDialog({
    title: "清理其他对话？",
    message: `会删除另外 ${others.length} 个对话窗口及其聊天记录。当前对话、日程和学习数据都会保留。`,
    confirmLabel: "清理旧对话",
    danger: true,
  });
  if (!confirmed) return;
  const active = activeConversation();
  state.conversations = [active];
  save();
  renderChat();
  showToast("旧对话窗口已经清理。");
}

async function openPersonaPromptModal() {
  toggleConversationPanel(false);
  let defaultPrompt = "";
  let astrbotPrompt = "";
  try {
    const [defaultResponse, astrbotResponse] = await Promise.all([
      fetch("/api/persona", { headers: { Accept: "application/json" } }),
      fetch("./assets/personas/dafeiyu-astrbot.md", { headers: { Accept: "text/markdown" } }),
    ]);
    if (defaultResponse.ok) {
      const data = await defaultResponse.json();
      defaultPrompt = String(data.prompt || "");
    }
    if (astrbotResponse.ok) astrbotPrompt = await astrbotResponse.text();
  } catch {
    // Keep whichever preset was loaded successfully.
  }
  const currentPrompt = state.settings.customPersonaPrompt || defaultPrompt;
  const activePreset =
    currentPrompt === astrbotPrompt
      ? "astrbot"
      : currentPrompt === defaultPrompt
        ? "original"
        : "custom";
  openModal(`
    <div class="modal-card persona-modal">
      <div class="modal-head">
        <div>
          <p class="card-kicker">PERSONA PROMPT</p>
          <h2>她的人设与预设</h2>
          <p>选择一套预设，或直接改下面全文；保存后只影响本机。</p>
        </div>
        <button class="icon-button small" type="button" data-modal-close aria-label="关闭">
          ${icon("close")}
        </button>
      </div>
      <form class="task-form" id="persona-form">
        <div class="persona-presets" id="persona-presets">
          <button class="persona-preset ${
            activePreset === "original" ? "is-active" : ""
          }" type="button" data-persona-preset="original">
            <strong>下载原版</strong>
            <span>dafeiyu-persona · MIT</span>
          </button>
          <button class="persona-preset ${
            activePreset === "astrbot" ? "is-active" : ""
          }" type="button" data-persona-preset="astrbot">
            <strong>AstrBot 真人感</strong>
            <span>黏人修订 · 73★ · MIT</span>
          </button>
          ${
            activePreset === "custom"
              ? `<span class="persona-preset is-active is-custom"><strong>当前自定义</strong><span>未套用预设</span></span>`
              : ""
          }
        </div>
        <p class="field-note" id="persona-source-note">${
          activePreset === "astrbot"
            ? "AstrBot 原版包含其平台工具与主动消息语境；本 Demo 的日程工具仍由独立协议约束。"
            : activePreset === "custom"
              ? "当前使用自定义提示词，可继续修改。"
              : "当前使用下载的 61★ 人设原版，未做改写。"
        }</p>
        <label class="field">
          <span>人设 / 系统提示词</span>
          <textarea name="prompt" rows="16" maxlength="16000" required>${escapeHtml(
            currentPrompt || "无法从本机服务读取默认人设，请确认 local-server.mjs 正在运行。",
          )}</textarea>
        </label>
        <p class="field-note">聊天入口仍然使用独立的应用接口协议；这里只控制角色人设和默认语气。</p>
        <div class="proactive-settings-box">
          <div class="proactive-settings-head">
            <div>
              <strong>主动搭话</strong>
              <span id="proactive-mode-note">每 ${Number(state.settings.proactiveIntervalMin) || 5} 分钟掷一次 · ${Math.round(
                (Number(state.settings.proactiveChance) || 0.35) * 100,
              )}% 概率${state.settings.quietHoursEnabled !== false ? " · 夜间静默" : " · 全天可搭话"}</span>
            </div>
            <button class="proactive-switch" type="button" id="modal-proactive-toggle"
              aria-pressed="${state.settings.proactiveEnabled !== false}" aria-label="开关主动搭话">
              <span></span>
            </button>
          </div>
          <div class="proactive-settings-grid">
            <label class="field">
              <span>检查间隔</span>
              <select name="proactiveInterval">
                ${[3, 5, 10, 15, 30]
                  .map(
                    (minutes) =>
                      `<option value="${minutes}" ${
                        Number(state.settings.proactiveIntervalMin) === minutes ? "selected" : ""
                      }>${minutes} 分钟</option>`,
                  )
                  .join("")}
              </select>
            </label>
            <label class="field">
              <span>触发概率</span>
              <div class="chance-range-row">
                <input type="range" name="proactiveChance" min="10" max="90" step="5"
                  value="${Math.round((Number(state.settings.proactiveChance) || 0.35) * 100)}">
                <output>${Math.round((Number(state.settings.proactiveChance) || 0.35) * 100)}%</output>
              </div>
            </label>
          </div>
          <div class="proactive-setting proactive-quiet-row">
            <div>
              <strong>夜间静默</strong>
              <span>23:00–08:00 不自动搭话</span>
            </div>
            <button class="proactive-switch" type="button" id="modal-quiet-hours-toggle"
              aria-pressed="${state.settings.quietHoursEnabled !== false}" aria-label="开关夜间静默">
              <span></span>
            </button>
          </div>
          <div class="proactive-modal-foot">
            <button class="proactive-test" type="button" id="test-proactive-in-modal">试一句</button>
            <span>关闭夜间静默后凌晨也会检查 · 用户未回复时不会连续追问</span>
          </div>
        </div>
        <div class="form-actions">
          <button class="quiet-button" type="button" data-modal-close>取消</button>
          <button class="primary-button compact" type="submit">保存设置</button>
        </div>
      </form>
    </div>`);
  const form = document.getElementById("persona-form");
  const sourceNote = document.getElementById("persona-source-note");
  const proactiveToggle = document.getElementById("modal-proactive-toggle");
  const quietHoursToggle = document.getElementById("modal-quiet-hours-toggle");
  const proactiveNote = document.getElementById("proactive-mode-note");
  const intervalSelect = form.elements.proactiveInterval;
  const chanceInput = form.elements.proactiveChance;
  const chanceOutput = chanceInput.parentElement.querySelector("output");
  const updateProactiveNote = () => {
    proactiveNote.textContent = proactiveToggle.getAttribute("aria-pressed") === "true"
      ? `每 ${intervalSelect.value} 分钟掷一次 · ${chanceInput.value}% 概率${
          quietHoursToggle.getAttribute("aria-pressed") === "true" ? " · 夜间静默" : " · 全天可搭话"
        }`
      : "已关闭 · 不会主动打扰";
  };
  proactiveToggle.addEventListener("click", () => {
    proactiveToggle.setAttribute(
      "aria-pressed",
      String(proactiveToggle.getAttribute("aria-pressed") !== "true"),
    );
    updateProactiveNote();
  });
  quietHoursToggle.addEventListener("click", () => {
    quietHoursToggle.setAttribute(
      "aria-pressed",
      String(quietHoursToggle.getAttribute("aria-pressed") !== "true"),
    );
    updateProactiveNote();
  });
  intervalSelect.addEventListener("change", updateProactiveNote);
  chanceInput.addEventListener("input", () => {
    chanceOutput.value = `${chanceInput.value}%`;
    updateProactiveNote();
  });
  document.getElementById("test-proactive-in-modal").addEventListener("click", () => {
    closeModal();
    triggerProactiveMessage({ manual: true });
  });
  document.querySelectorAll("[data-persona-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = button.dataset.personaPreset;
      const prompt = preset === "astrbot" ? astrbotPrompt : defaultPrompt;
      if (!prompt) {
        showToast("这套预设还没加载成功，检查文件或本机服务。");
        return;
      }
      document.querySelectorAll(".persona-preset").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
      form.elements.prompt.value = prompt;
      sourceNote.textContent =
        preset === "astrbot"
          ? "AstrBot 原版包含其平台工具与主动消息语境；本 Demo 的日程工具仍由独立协议约束。"
          : "已载入下载的 61★ 人设原版，未做改写。";
    });
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const prompt = String(new FormData(form).get("prompt") || "").trim();
    if (!prompt) {
      showToast("提示词不能为空。");
      return;
    }
    state.settings.customPersonaPrompt = prompt === defaultPrompt ? "" : prompt.slice(0, 16000);
    state.settings.personaPreset =
      prompt === astrbotPrompt ? "astrbot" : prompt === defaultPrompt ? "original" : "custom";
    state.settings.proactiveEnabled = proactiveToggle.getAttribute("aria-pressed") === "true";
    state.settings.quietHoursEnabled = quietHoursToggle.getAttribute("aria-pressed") === "true";
    state.settings.proactiveIntervalMin = Number(intervalSelect.value) || 5;
    state.settings.proactiveChance = Math.max(
      0.05,
      Math.min(0.95, (Number(chanceInput.value) || 35) / 100),
    );
    save();
    scheduleProactiveChat();
    closeModal();
    showToast("预设提示词已保存在本机。");
  });
}

function tasksForDate(dateKey) {
  return state.tasks
    .filter((task) => task.dateKey === dateKey)
    .sort((left, right) => {
      if (left.done !== right.done) return Number(left.done) - Number(right.done);
      return timeToMinutes(left.start) - timeToMinutes(right.start);
    });
}

function taskDateTimeForContext(task) {
  return new Date(`${task.dateKey}T${task.start}:00`).getTime();
}

function todayTasks(includeDone = true) {
  const tasks = tasksForDate(toDateKey());
  return includeDone ? tasks : tasks.filter((task) => !task.done);
}

function taskEnd(task) {
  return addMinutes(task.start, task.duration);
}

function taskTimeLabel(task) {
  return `${task.start}–${taskEnd(task)}`;
}

function toneFor(task) {
  return TASK_TONES[task?.tone] || TASK_TONES.sea;
}

function todaySessions() {
  return state.sessions.filter((session) => session.dateKey === toDateKey());
}

function completedSessionsFor(dateKey = toDateKey()) {
  return state.sessions.filter(
    (session) => session.dateKey === dateKey && session.completed !== false,
  );
}

function currentStreak() {
  const checkins = new Set(state.checkins);
  let cursor = new Date();
  if (!checkins.has(toDateKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (checkins.has(toDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function ensureCheckIn(dateKey = toDateKey()) {
  if (!state.checkins.includes(dateKey)) {
    state.checkins.push(dateKey);
    state.checkins = [...new Set(state.checkins)].sort();
  }
}

function pickNextTask(tasks) {
  const open = tasks.filter((task) => !task.done);
  if (!open.length) return null;
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  return (
    open.find((task) => timeToMinutes(task.start) + Number(task.duration) >= nowMinutes - 15) ||
    open[0]
  );
}

function renderTomatoSeeds(container, sessions, limit = 6) {
  if (!container) return;
  if (!sessions.length) {
    container.innerHTML = `<span class="empty-jar">再添一颗番茄</span>`;
    return;
  }
  const visible = sessions.slice(0, limit);
  container.innerHTML =
    visible.map(() => `<span class="tomato-seed" aria-hidden="true"></span>`).join("") +
    (sessions.length > limit ? `<span class="empty-jar">+${sessions.length - limit}</span>` : "");
}

function renderMiniTomatoes(container, count) {
  if (!container) return;
  container.innerHTML = Array.from(
    { length: Math.min(10, count) },
    () => `<span class="mini-tomato" aria-hidden="true"></span>`,
  ).join("");
}

function renderAll() {
  applyChatWidth();
  renderTopbar();
  renderChatHeader();
  renderNavigation();
  renderSidebar();
  renderToday();
  renderFocus();
  renderSchedule();
  renderChat();
  updatePetMood();
}

function applyChatWidth() {
  if (!els.homeLayout) return;
  const maxByViewport = window.innerWidth <= 1180 ? 430 : 540;
  const width = Math.max(300, Math.min(maxByViewport, Number(state.settings.chatWidth) || 380));
  els.homeLayout.style.setProperty("--chat-width", `${width}px`);
}

function initChatResize() {
  if (!els.chatResizeHandle) return;
  let startX = 0;
  let startWidth = 380;
  els.chatResizeHandle.addEventListener("pointerdown", (event) => {
    if (window.innerWidth <= 960 || event.button !== 0) return;
    event.preventDefault();
    startX = event.clientX;
    startWidth =
      Number.parseFloat(getComputedStyle(els.homeLayout).getPropertyValue("--chat-width")) ||
      state.settings.chatWidth ||
      380;
    els.body.classList.add("is-resizing-chat");
    els.chatResizeHandle.setPointerCapture?.(event.pointerId);
  });
  els.chatResizeHandle.addEventListener("pointermove", (event) => {
    if (!els.body.classList.contains("is-resizing-chat")) return;
    const maxByViewport = window.innerWidth <= 1180 ? 430 : 540;
    const nextWidth = Math.max(
      300,
      Math.min(maxByViewport, startWidth - (event.clientX - startX)),
    );
    state.settings.chatWidth = nextWidth;
    els.homeLayout.style.setProperty("--chat-width", `${nextWidth}px`);
    requestAnimationFrame(() => {
      live2dApp?.resize?.();
      fitLive2DModel();
    });
  });
  const finish = () => {
    if (!els.body.classList.contains("is-resizing-chat")) return;
    els.body.classList.remove("is-resizing-chat");
    save();
  };
  els.chatResizeHandle.addEventListener("pointerup", finish);
  els.chatResizeHandle.addEventListener("pointercancel", finish);
}

function renderTopbar() {
  const now = new Date();
  const hour = now.getHours();
  const userName = state.settings.userName || "主人";
  const greeting = hour < 6 ? "凌晨好" : hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";
  els.topbarWeekday.textContent = `${WEEKDAY_LONG[now.getDay()]} · ${now.getMonth() + 1} 月 ${now.getDate()} 日`;
  els.topbarGreeting.textContent = `${greeting}，${userName}`;
}

function renderChatHeader() {
  const petName = state.settings.petName || "大肥鱼";
  els.chatPetName.textContent = `和${petName}说话`;
  document.querySelector(".rail-brand")?.setAttribute("aria-label", `回到${petName}`);
}

function renderNavigation() {
  els.body.dataset.view = ui.view;
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.viewPanel === ui.view);
  });
  document.querySelectorAll("[data-go-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.goView === ui.view);
  });
}

function renderSidebar() {
  const tasks = todayTasks();
  const next = pickNextTask(tasks);
  const completed = completedSessionsFor().length;
  ui.nextTaskId = next?.id || "";
  if (!state.timer.status || state.timer.status === "idle") {
    els.sidebarNextTitle.textContent = next?.title || "先专注 25 分钟";
  }
  renderMiniTomatoes(els.sidebarTomatoes, completed);
  els.sidebarStreak.textContent = String(currentStreak());
}

function applyNextTaskVisibility() {
  const hidden = Boolean(state.settings.nextTaskCardHidden);
  els.homeNextSlot.hidden = hidden;
  els.showNextTask.hidden = !hidden;
  els.homeNextSlot.closest(".home-lower")?.classList.toggle("is-next-hidden", hidden);
}

function renderToday() {
  const tasks = todayTasks();
  const completedTasks = tasks.filter((task) => task.done).length;
  const next = pickNextTask(tasks);
  const sessions = todaySessions();
  const completed = completedSessionsFor();
  const focusMinutes = sessions.reduce((sum, session) => sum + Number(session.minutes || 0), 0);
  const streak = currentStreak();
  applyNextTaskVisibility();

  els.todayTaskProgress.textContent = `${completedTasks} / ${tasks.length} 件事`;
  ui.nextTaskId = next?.id || "";

  if (next) {
    els.nextTaskTitle.textContent = next.title;
    els.nextTaskMeta.textContent = `${taskTimeLabel(next)} · ${formatDuration(next.duration)} · ${
      next.priority === "high" ? "往前挪一点" : "不急，稳稳做"
    }`;
    els.nextTaskFocus.disabled = false;
    els.nextTaskFocus.dataset.taskId = next.id;
  } else {
    els.nextTaskTitle.textContent = tasks.length ? "今天的事都收尾了" : "今天还没有安排";
    els.nextTaskMeta.textContent = tasks.length
      ? "可以把鱼鳍收起来，剩下的时间留给自己。"
      : "给自己留 25 分钟，也算好好开始。";
    els.nextTaskFocus.disabled = false;
    els.nextTaskFocus.dataset.taskId = "";
  }

  els.todaySubtitle.textContent = tasks.length
    ? `${tasks.length} 件小事，不需要每一件都做到满分。`
    : "今天是空白的也没关系，先放一件小事进来。";

  els.todayStats.innerHTML = [
    statCard({
      label: "专注分钟",
      value: focusMinutes,
      unit: "min",
      foot: "包括提前收鳍的有效时间",
      icon: "timer",
      color: "#2e7180",
      wash: "#e5f2ed",
    }),
    statCard({
      label: "今日番茄",
      value: completed.length,
      unit: "颗",
      foot: completed.length ? "已经存进小罐子" : "还空着，不催你",
      icon: "tomato",
      color: "#db655b",
      wash: "#ffe0d8",
    }),
    statCard({
      label: "今日完成",
      value: `${completedTasks}/${tasks.length || 0}`,
      unit: "件",
      foot: tasks.length ? "完成一点也算数" : "可以先添加一件",
      icon: "check",
      color: "#618b68",
      wash: "#e8f2e2",
    }),
    statCard({
      label: "连续上岸",
      value: streak,
      unit: "天",
      foot: "断一天也不会扣掉已有成果",
      icon: "heart",
      color: "#c58e2e",
      wash: "#fff0c9",
    }),
  ].join("");

  els.todayTaskList.innerHTML = tasks.length
    ? tasks
        .slice(0, 6)
        .map((task) => {
          const tone = toneFor(task);
          return `
            <div class="today-task-item ${task.done ? "is-done" : ""}" data-task-open="${escapeHtml(task.id)}">
              <span class="task-time">${escapeHtml(task.start)}</span>
              <div class="task-copy">
                <strong><span class="task-dot" style="--task-color:${tone.color}"></span>${escapeHtml(task.title)}</strong>
                <span>${escapeHtml(formatDuration(task.duration))}${task.priority === "high" ? " · 有点重要" : ""}</span>
              </div>
              <button class="task-check" type="button" data-task-toggle="${escapeHtml(task.id)}" aria-label="${
                task.done ? "标记为未完成" : "标记完成"
              }">${icon("check")}</button>
            </div>`;
        })
        .join("")
    : emptyState("今天还没有安排", "先挑一件 25 分钟能碰一下的小事。", "安排一件事", "add-task");

  renderWeekRhythm();
  renderTomatoSeeds(els.todayTomatoSeeds, completed, 8);
  renderMiniTomatoes(els.sidebarTomatoes, completed.length);
}

function statCard({ label, value, unit, foot, icon: iconName, color, wash }) {
  const markup =
    iconName === "tomato"
      ? `<span class="mini-tomato" aria-hidden="true"></span>`
      : icon(iconName);
  return `
    <article class="stat-card">
      <div class="stat-top">
        <span>${escapeHtml(label)}</span>
        <span class="stat-icon" style="--stat-color:${color};--stat-wash:${wash}">${markup}</span>
      </div>
      <div class="stat-value"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(unit)}</span></div>
      <p class="stat-foot">${escapeHtml(foot)}</p>
    </article>`;
}

function renderWeekRhythm() {
  const days = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const date = addDays(new Date(), offset);
    const dateKey = toDateKey(date);
    const sessions = state.sessions.filter((session) => session.dateKey === dateKey);
    days.push({
      date,
      dateKey,
      minutes: sessions.reduce((sum, session) => sum + Number(session.minutes || 0), 0),
    });
  }
  const max = Math.max(60, ...days.map((day) => day.minutes));
  const total = days.reduce((sum, day) => sum + day.minutes, 0);
  els.weekTotalPill.textContent = formatDuration(total);
  els.rhythmCaption.textContent =
    total > 180
      ? "这周游得不少了，记得也给鱼鳍留一点空白。"
      : total > 0
        ? "不用每天都很满，能回来就好。"
        : "海面还很安静，什么时候回来都可以。";
  els.weekRhythm.innerHTML = days
    .map((day) => {
      const height = day.minutes ? Math.max(8, Math.round((day.minutes / max) * 82)) : 4;
      return `
        <div class="rhythm-day ${day.dateKey === toDateKey() ? "is-today" : ""}">
          <div class="rhythm-bar-wrap">
            <span class="rhythm-value">${day.minutes || 0}m</span>
            <span class="rhythm-bar" style="height:${height}px"></span>
          </div>
          <small>${WEEKDAY_SHORT[day.date.getDay()].replace("周", "")}</small>
        </div>`;
    })
    .join("");
}

function emptyState(title, description, actionLabel = "", action = "") {
  return `
    <div class="empty-state">
      <span class="empty-state-mark">${icon("spark")}</span>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(description)}</p>
      ${
        actionLabel
          ? `<button class="quiet-button" type="button" data-${
              action === "add-task" ? "add-task" : "prompt"
            }="${action === "add-task" ? "" : escapeHtml(action)}">${escapeHtml(actionLabel)}</button>`
          : ""
      }
    </div>`;
}

function activePlan() {
  return state.plans.find((plan) => plan.status === "active") || null;
}

function renderFocus() {
  renderFocusTaskOptions();
  renderActivePlan();
  renderFocusTomatoes();
  const quoteIndex = new Date().getDate() % FOCUS_QUOTES.length;
  els.focusQuote.textContent = FOCUS_QUOTES[quoteIndex];
  updateTimerDisplays();
}

function renderFocusTaskOptions() {
  const tasks = todayTasks();
  const selected = state.timer.taskId || state.settings.focusTaskId || "";
  const timerTask = selected ? state.tasks.find((task) => task.id === selected) : null;
  const options = [
    `<option value="">自由专注</option>`,
    ...tasks.map(
      (task) =>
        `<option value="${escapeHtml(task.id)}">${escapeHtml(task.title)}${
          task.done ? " · 已完成" : ""
        }</option>`,
    ),
  ];
  if (timerTask && !tasks.some((task) => task.id === timerTask.id)) {
    options.push(`<option value="${escapeHtml(timerTask.id)}">${escapeHtml(timerTask.title)}</option>`);
  }
  els.focusTaskSelect.innerHTML = options.join("");
  els.focusTaskSelect.value = selected;
  els.focusTaskSelect.disabled = state.timer.status === "running" || state.timer.status === "paused";
}

function renderActivePlan() {
  const plan = activePlan();
  if (!plan) {
    els.activePlanCard.innerHTML = `
      <div class="card-heading">
        <div>
          <p class="card-kicker">FOCUS ROUTE</p>
          <h2>还没有专注航线</h2>
        </div>
      </div>
      <div class="empty-state" style="min-height:154px;padding:17px 8px">
        <span class="empty-state-mark">${icon("spark")}</span>
        <strong>把一坨事拆成几小口</strong>
        <p>告诉本鱼你想做什么，它会先给出一张待确认的计划卡。</p>
        <button class="quiet-button" type="button" data-prompt="帮我拆一下今天要做的事">让本鱼拆一下</button>
      </div>`;
    return;
  }

  const currentIndex = Math.max(
    0,
    plan.items.findIndex((item) => item.id === plan.currentItemId),
  );
  const current = plan.items[currentIndex] || plan.items[0];
  const allRounds = plan.items.reduce((sum, item) => sum + Number(item.targetRounds || 1), 0);
  const doneRounds = plan.items.reduce((sum, item) => sum + Number(item.completedRounds || 0), 0);
  els.activePlanCard.innerHTML = `
    <div class="card-heading">
      <div>
        <p class="card-kicker">FOCUS ROUTE · ${doneRounds}/${allRounds} 轮</p>
        <h2>${escapeHtml(plan.title)}</h2>
      </div>
      <span class="plan-status">进行中</span>
    </div>
    <div class="plan-item-list">
      ${plan.items
        .map((item, index) => {
          const isDone = item.completedRounds >= item.targetRounds;
          const pips = Array.from(
            { length: Math.min(8, item.targetRounds) },
            (_, roundIndex) =>
              `<span class="${roundIndex < item.completedRounds ? "is-done" : ""}"></span>`,
          ).join("");
          return `
            <div class="plan-item ${item.id === current.id ? "is-current" : ""} ${
              isDone ? "is-done" : ""
            }">
              <span class="plan-item-index">${isDone ? icon("check") : index + 1}</span>
              <div class="plan-item-copy">
                <strong>${escapeHtml(item.label)}</strong>
                <span>${item.completedRounds}/${item.targetRounds} 轮</span>
              </div>
              <span class="plan-round-pips" aria-hidden="true">${pips}</span>
            </div>`;
        })
        .join("")}
    </div>
    <button class="plan-start-button" type="button" data-start-plan="${escapeHtml(plan.id)}">
      ${icon("play")}
      <span>从「${escapeHtml(current.label)}」开始一轮</span>
    </button>`;
}

function renderFocusTomatoes() {
  const sessions = completedSessionsFor();
  els.focusTomatoCount.textContent = String(sessions.length);
  if (!sessions.length) {
    els.focusTomatoJar.innerHTML = `<span class="empty-jar">罐子还空着，不着急。</span>`;
    els.focusTomatoCaption.textContent = "完成一轮，本鱼就替你存一颗。";
  } else {
    els.focusTomatoJar.innerHTML =
      sessions
        .slice(0, 12)
        .map(() => `<span class="tomato-seed" aria-hidden="true"></span>`)
        .join("") +
      (sessions.length > 12 ? `<span class="empty-jar">+${sessions.length - 12}</span>` : "");
    els.focusTomatoCaption.textContent = `今天已经存了 ${sessions.length} 颗。够不够都算数。`;
  }
}

function timerRemaining() {
  if (state.timer.status === "running" && state.timer.endsAt) {
    return Math.max(0, Math.ceil((state.timer.endsAt - Date.now()) / 1000));
  }
  return Math.max(0, Number(state.timer.remainingSec) || 0);
}

function updateTimerDisplays() {
  const remaining = timerRemaining();
  const duration = Math.max(1, Number(state.timer.durationSec) || ui.focusMinutes * 60);
  const progress = Math.min(1, Math.max(0, 1 - remaining / duration));
  const running = state.timer.status === "running";
  const paused = state.timer.status === "paused";
  const idle = !running && !paused;
  const breakMode = state.timer.mode === "break";

  els.focusTime.textContent = formatClock(remaining);
  els.focusModeLabel.textContent = breakMode
    ? `REST · ${Math.max(1, Math.round(duration / 60))} MIN`
    : `FOCUS · ${Math.max(1, Math.round(duration / 60))} MIN`;
  els.focusRing.style.strokeDasharray = String(RING_CIRCUMFERENCE);
  els.focusRing.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));

  const statusText = running
    ? breakMode
      ? "休息中"
      : "正在游"
    : paused
      ? "暂停中"
      : breakMode
        ? "准备休息"
        : "准备出发";
  els.focusStatusChip.querySelector("span:last-child").textContent = statusText;

  if (idle) {
    setIcon(els.focusPrimary, "play");
    els.focusPrimary.querySelector("span").textContent = breakMode ? "开始休息" : "开始专注";
  } else if (running) {
    setIcon(els.focusPrimary, "pause");
    els.focusPrimary.querySelector("span").textContent = breakMode ? "暂停休息" : "暂停一下";
  } else {
    setIcon(els.focusPrimary, "play");
    els.focusPrimary.querySelector("span").textContent = breakMode ? "继续休息" : "继续游";
  }

  els.focusSecondary.hidden = idle;
  els.focusSecondary.querySelector("span").textContent = breakMode ? "结束休息" : "结束这一轮";
  els.focusPresets.querySelectorAll("button").forEach((button) => {
    const minutes = Number(button.dataset.focusMinutes);
    const activeMinutes = breakMode
      ? Number(button.dataset.focusMinutes) === Number(state.settings.focusMinutes)
      : Number(button.dataset.focusMinutes) === Math.round(duration / 60);
    button.classList.toggle("is-active", activeMinutes);
    button.disabled = !idle || breakMode;
  });

  if (breakMode) {
    els.focusWhisper.textContent = running ? "喝水、看远处，别偷偷想任务。" : "休息不是偷懒，是让鱼鳍回血。";
    els.focusPrimary.classList.add("is-break");
  } else {
    els.focusWhisper.textContent = running
      ? "本鱼安静一点，只帮你看时间。"
      : paused
        ? "停一下也没关系，回来再继续。"
        : "本鱼会安静一点";
    els.focusPrimary.classList.remove("is-break");
  }

  els.body.classList.toggle("is-running", running);

  if (running || paused) {
    els.sidebarNextTitle.textContent = `${breakMode ? "休息中" : paused ? "暂停中" : "正在专注"} · ${formatClock(remaining)}`;
    els.topbarStartFocus.querySelector("span").textContent = "回到专注";
    els.sidebarStartFocus.setAttribute("aria-label", "查看专注");
  } else {
    const next = pickNextTask(todayTasks());
    els.sidebarNextTitle.textContent = next?.title || "先专注 25 分钟";
    els.topbarStartFocus.querySelector("span").textContent = "开始专注";
    els.sidebarStartFocus.setAttribute("aria-label", "开始专注");
  }

  updatePetMood();
}

function selectFocusMinutes(minutes) {
  if (state.timer.status === "running" || state.timer.status === "paused") return;
  ui.focusMinutes = Math.max(5, Math.min(180, Number(minutes) || 25));
  state.settings.focusMinutes = ui.focusMinutes;
  state.timer.mode = "focus";
  state.timer.durationSec = ui.focusMinutes * 60;
  state.timer.remainingSec = ui.focusMinutes * 60;
  state.timer.endsAt = null;
  state.timer.startedAt = null;
  save();
  renderFocus();
}

function startNewFocus({ durationMin, taskId = "", planId = null, planItemId = null }) {
  if (state.timer.status === "running" || state.timer.status === "paused") {
    setView("focus");
    showToast("另一条鱼还在计时，先回到这一轮。");
    return;
  }
  const minutes = Math.max(5, Math.min(180, Number(durationMin) || ui.focusMinutes || 25));
  ui.focusMinutes = minutes;
  state.settings.focusMinutes = minutes;
  state.settings.focusTaskId = taskId || "";
  state.timer = {
    id: uid("focus"),
    status: "running",
    mode: "focus",
    durationSec: minutes * 60,
    remainingSec: minutes * 60,
    endsAt: Date.now() + minutes * 60 * 1000,
    startedAt: new Date().toISOString(),
    taskId: taskId || "",
    planId,
    planItemId,
  };
  save();
  setView("focus", { preserveScroll: true });
  renderAll();
  speakAsPet("去吧，就这一小段。本鱼不催，只看潮汐。", 6500);
  setPetMood("focus");
}

function toggleTimer() {
  const timer = state.timer;
  if (timer.status === "running") {
    timer.remainingSec = timerRemaining();
    timer.status = "paused";
    timer.endsAt = null;
    save();
    renderFocus();
    renderSidebar();
    speakAsPet("停一下也行。鱼鳍放平，本鱼等你。", 4800);
    return;
  }
  if (timer.status === "paused") {
    timer.status = "running";
    timer.endsAt = Date.now() + Math.max(1, timer.remainingSec) * 1000;
    save();
    renderFocus();
    renderSidebar();
    speakAsPet("回来了？那继续，别跟时间赌气。", 4300);
    return;
  }

  if (timer.mode === "break") {
    timer.status = "running";
    timer.durationSec = 5 * 60;
    timer.remainingSec = 5 * 60;
    timer.endsAt = Date.now() + 5 * 60 * 1000;
    timer.startedAt = new Date().toISOString();
    save();
    renderFocus();
    speakAsPet("去喝水。不许边休息边想下一件事。", 5200);
    return;
  }

  startNewFocus({
    durationMin: ui.focusMinutes,
    taskId: els.focusTaskSelect.value || "",
  });
}

async function abandonTimer() {
  const timer = state.timer;
  if (!timer.status) return;
  const isBreak = timer.mode === "break";
  const confirmed = await confirmDialog({
    title: isBreak ? "提前结束休息？" : "要收起鱼鳍吗？",
    message: isBreak
      ? "这次休息不会进入学习统计。"
      : "这一轮不算番茄，但已经专注的时间会记进统计。",
    confirmLabel: isBreak ? "结束休息" : "结束并记录",
    danger: false,
  });
  if (!confirmed) return;

  if (!isBreak) {
    const remaining = timerRemaining();
    const elapsedSeconds = Math.max(0, timer.durationSec - remaining);
    const minutes = elapsedSeconds >= 30 ? Math.max(1, Math.round(elapsedSeconds / 60)) : 0;
    if (minutes > 0 && !state.sessions.some((session) => session.id === timer.id)) {
      const task = state.tasks.find((item) => item.id === timer.taskId);
      state.sessions.push({
        id: timer.id,
        dateKey: toDateKey(),
        minutes,
        completed: false,
        taskTitle: task?.title || "自由专注",
        taskId: task?.id || "",
        endedAt: new Date().toISOString(),
      });
      const total = todaySessions().reduce((sum, session) => sum + Number(session.minutes || 0), 0);
      if (total >= 25) ensureCheckIn();
      showToast(`记下了 ${minutes} 分钟，不算番茄。`);
    } else {
      showToast("这一轮先不记账，下次再游。");
    }
  }

  resetTimerToIdle();
  save();
  renderAll();
  setPetMood("idle");
}

function resetTimerToIdle() {
  state.timer = {
    id: null,
    status: "idle",
    mode: "focus",
    durationSec: ui.focusMinutes * 60,
    remainingSec: ui.focusMinutes * 60,
    endsAt: null,
    startedAt: null,
    taskId: "",
    planId: null,
    planItemId: null,
  };
}

function tickTimer() {
  if (state.timer.status !== "running") return;
  const remaining = timerRemaining();
  updateTimerDisplays();
  if (remaining <= 0) completeTimer();
}

function completeTimer() {
  if (completingFocus || state.timer.status !== "running") return;
  completingFocus = true;
  const timer = state.timer;

  if (timer.mode === "break") {
    resetTimerToIdle();
    save();
    renderAll();
    speakAsPet("休息完啦。鱼鳍回血，继续还是收工？", 5200);
    setPetMood("idle");
    completingFocus = false;
    return;
  }

  const task = state.tasks.find((item) => item.id === timer.taskId);
  const minutes = Math.max(1, Math.round(timer.durationSec / 60));
  if (!state.sessions.some((session) => session.id === timer.id)) {
    state.sessions.push({
      id: timer.id,
      dateKey: toDateKey(),
      minutes,
      completed: true,
      taskTitle: task?.title || "自由专注",
      taskId: task?.id || "",
      planId: timer.planId,
      planItemId: timer.planItemId,
      endedAt: new Date().toISOString(),
    });
    const total = todaySessions().reduce((sum, session) => sum + Number(session.minutes || 0), 0);
    if (total >= 25) ensureCheckIn();
    if (timer.planId) advancePlan(timer.planId, timer.planItemId);
  }

  const completedTaskId = timer.taskId;
  const completedDuration = minutes;
  state.timer = {
    id: null,
    status: "idle",
    mode: "break",
    durationSec: 5 * 60,
    remainingSec: 5 * 60,
    endsAt: null,
    startedAt: null,
    taskId: completedTaskId,
    planId: null,
    planItemId: null,
  };
  save();
  renderAll();
  setPetMood("happy", 5600);
  speakAsPet("收工！这一轮算本鱼陪你游回来的。", 7000);
  fireConfetti();
  showSuccessOverlay({ minutes: completedDuration, task });
  completingFocus = false;
}

function advancePlan(planId, itemId) {
  const plan = state.plans.find((item) => item.id === planId);
  if (!plan) return;
  const current =
    plan.items.find((item) => item.id === itemId) ||
    plan.items.find((item) => item.id === plan.currentItemId);
  if (current && current.completedRounds < current.targetRounds) {
    current.completedRounds += 1;
  }
  const next = plan.items.find((item) => item.completedRounds < item.targetRounds);
  if (next) {
    plan.currentItemId = next.id;
  } else {
    plan.status = "completed";
    plan.completedAt = new Date().toISOString();
  }
}

function showSuccessOverlay({ minutes, task }) {
  const existing = document.querySelector(".success-overlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "success-overlay";
  overlay.innerHTML = `
    <div class="success-card">
      <div class="success-tomato" aria-hidden="true"></div>
      <h2>一颗番茄，稳稳收下。</h2>
      <p>刚刚专注了 ${minutes} 分钟${task ? `，推进了「${escapeHtml(task.title)}」` : ""}。现在不用立刻做下一件，先让鱼鳍缓一缓。</p>
      <div class="success-actions">
        <button class="quiet-button" type="button" data-success-action="today">回到今天</button>
        <button class="primary-button" type="button" data-success-action="break">休息 5 分钟</button>
        <button class="quiet-button" type="button" data-success-action="again">再来一轮</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.remove();
      return;
    }
    const action = event.target.closest("[data-success-action]")?.dataset.successAction;
    if (!action) return;
    overlay.remove();
    if (action === "today") setView("today");
    if (action === "break") {
      state.timer.status = "running";
      state.timer.mode = "break";
      state.timer.durationSec = 5 * 60;
      state.timer.remainingSec = 5 * 60;
      state.timer.endsAt = Date.now() + 5 * 60 * 1000;
      state.timer.startedAt = new Date().toISOString();
      save();
      setView("focus", { preserveScroll: true });
      renderAll();
    }
    if (action === "again") {
      startNewFocus({ durationMin: minutes, taskId: task?.id || "" });
    }
  });
}

function startPlan(planId) {
  const plan = state.plans.find((item) => item.id === planId);
  if (!plan || plan.status !== "active") return;
  const current =
    plan.items.find((item) => item.id === plan.currentItemId) ||
    plan.items.find((item) => item.completedRounds < item.targetRounds);
  if (!current) return;
  startNewFocus({
    durationMin: plan.focusMinutes || ui.focusMinutes,
    taskId: current.taskId || "",
    planId: plan.id,
    planItemId: current.id,
  });
}

function renderSchedule() {
  const anchorDate = ui.scheduleAnchor;
  const anchorKey = toDateKey(anchorDate);
  const weekStart = startOfWeekMonday(anchorDate);

  if (ui.scheduleMode === "day") {
    const isToday = anchorKey === toDateKey();
    els.scheduleTitle.textContent = isToday
      ? "今天，安排得刚刚好。"
      : `${anchorDate.getMonth() + 1} 月 ${anchorDate.getDate()} 日，慢慢排。`;
    const tasks = tasksForDate(anchorKey);
    els.scheduleSubtitle.textContent = tasks.length
      ? `${tasks.length} 件事。中间留白的地方，也算日程的一部分。`
      : "这天还很空。留白也很好，或者放一件小事进来。";
  } else {
    const weekEnd = addDays(weekStart, 6);
    els.scheduleTitle.textContent = "这一周，留一点呼吸。";
    els.scheduleSubtitle.textContent = `${weekStart.getMonth() + 1} 月 ${weekStart.getDate()} 日 – ${
      weekEnd.getMonth() + 1
    } 月 ${weekEnd.getDate()} 日，不用把七格都填满。`;
  }

  document.querySelectorAll("[data-schedule-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.scheduleView === ui.scheduleMode);
  });

  if (ui.scheduleMode === "week") renderWeekSchedule(weekStart);
  else renderDaySchedule(anchorDate);
}

function renderDaySchedule(date) {
  const dateKey = toDateKey(date);
  const tasks = tasksForDate(dateKey);
  const startHour = 6;
  const hourHeight = 58;
  const hours = Array.from({ length: 18 }, (_, index) => startHour + index);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isToday = dateKey === toDateKey();
  const showNow = isToday && nowMinutes >= startHour * 60 && nowMinutes < 24 * 60;
  const nowTop = 16 + ((nowMinutes - startHour * 60) / 60) * hourHeight;

  const taskBlocks = tasks
    .map((task) => {
      const tone = toneFor(task);
      const startMinutes = timeToMinutes(task.start);
      const top = 16 + Math.max(0, ((startMinutes - startHour * 60) / 60) * hourHeight);
      const height = Math.max(38, (Number(task.duration) / 60) * hourHeight - 5);
      return `
        <button class="timeline-task ${task.done ? "is-done" : ""}" type="button"
          data-task-open="${escapeHtml(task.id)}"
          style="top:${top}px;height:${height}px;--task-color:${tone.color};--task-wash:${tone.wash}">
          <strong>${escapeHtml(task.title)}</strong>
          <span>${escapeHtml(taskTimeLabel(task))} · ${formatDuration(task.duration)}</span>
        </button>`;
    })
    .join("");

  els.scheduleContent.innerHTML = `
    <div class="day-schedule-head">
      <div>
        <h2>${formatDate(date)}</h2>
        <p>${tasks.filter((task) => !task.done).length} 件待做 · ${tasks.filter((task) => task.done).length} 件完成</p>
      </div>
      <span class="day-count-pill">${icon("calendar")} ${tasks.length} 件事</span>
    </div>
    <div class="day-timeline-scroll">
      <div class="day-timeline" style="min-height:${hours.length * hourHeight + 34}px">
        ${hours
          .map(
            (hour) => `
          <div class="timeline-hour">
            <span>${String(hour).padStart(2, "0")}:00</span>
          </div>`,
          )
          .join("")}
        ${taskBlocks}
        ${
          showNow
            ? `<div class="timeline-now" style="top:${nowTop}px"><span>${String(now.getHours()).padStart(
                2,
                "0",
              )}:${String(now.getMinutes()).padStart(2, "0")}</span></div>`
            : ""
        }
        ${
          tasks.length
            ? ""
            : `<div class="timeline-empty"><strong>这天还空着</strong><span>不用急着填满，想放点什么再放。</span></div>`
        }
      </div>
    </div>`;
}

function renderWeekSchedule(weekStart) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  els.scheduleContent.innerHTML = `
    <div class="week-board-wrap">
      <div class="week-board">
        <div class="week-head-row">
          ${days
            .map((date) => {
              const isToday = toDateKey(date) === toDateKey();
              return `
                <div class="week-day-head ${isToday ? "is-today" : ""}">
                  <span>${WEEKDAY_SHORT[date.getDay()]}</span>
                  <strong>${date.getDate()}</strong>
                  <button class="week-add-mini" type="button" data-add-date="${toDateKey(date)}" aria-label="在这一天添加任务">
                    ${icon("plus")}
                  </button>
                </div>`;
            })
            .join("")}
        </div>
        <div class="week-body-row">
          ${days
            .map((date) => {
              const dateKey = toDateKey(date);
              const tasks = tasksForDate(dateKey);
              const visible = tasks.slice(0, 5);
              return `
                <div class="week-day-column ${dateKey === toDateKey() ? "is-today" : ""}">
                  ${
                    visible.length
                      ? visible
                          .map((task) => {
                            const tone = toneFor(task);
                            return `
                              <button class="week-task ${task.done ? "is-done" : ""}" type="button"
                                data-task-open="${escapeHtml(task.id)}"
                                style="--task-color:${tone.color};--task-wash:${tone.wash}">
                                <time>${escapeHtml(task.start)}</time>
                                <strong>${escapeHtml(task.title)}</strong>
                              </button>`;
                          })
                          .join("")
                      : `<div class="week-empty">留白</div>`
                  }
                  ${
                    tasks.length > visible.length
                      ? `<button class="week-more" type="button" data-open-day="${dateKey}">还有 ${
                          tasks.length - visible.length
                        } 件</button>`
                      : ""
                  }
                </div>`;
            })
            .join("")}
        </div>
      </div>
    </div>`;
}

function formatChatTime(isoString) {
  const date = new Date(isoString);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function chatAvatarMarkup() {
  return `<span class="chat-avatar" aria-hidden="true"><img src="./assets/stickers/avatar.png" alt=""></span>`;
}

function renderChatContent(message) {
  if (message.sticker) {
    return `<div class="chat-bubble sticker-bubble">
      <img src="${escapeHtml(message.sticker.src)}" alt="${escapeHtml(message.sticker.alt || "大肥鱼表情包")}">
      <div class="chat-time">${formatChatTime(message.at)}</div>
    </div>`;
  }
  if (message.kind === "emote") {
    return `<div class="emote-log">表情 · ${escapeHtml(message.expressionLabel || message.text)}</div>`;
  }
  return `<div class="chat-bubble">${escapeHtml(message.text)}<div class="chat-time">${formatChatTime(
    message.at,
  )}</div></div>`;
}

function renderChat() {
  const messages = activeMessages().slice(-50);
  els.chatMessages.innerHTML = messages
    .map((message) => {
      const user = message.role === "user";
      const proposals = Array.isArray(message.proposals) ? message.proposals : [];
      return `
        <div class="chat-row ${user ? "is-user" : ""}">
          ${user ? "" : chatAvatarMarkup()}
          ${renderChatContent(message)}
        </div>
        ${proposals.map((proposal) => renderProposalCard(message.id, proposal)).join("")}`;
    })
    .join("");

  if (ui.typing) {
    els.chatMessages.insertAdjacentHTML(
      "beforeend",
      `<div class="chat-row">
        ${chatAvatarMarkup()}
        <div class="typing-bubble" aria-label="本鱼正在想"><span></span><span></span><span></span></div>
      </div>`,
    );
  }

  requestAnimationFrame(() => {
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  });
}

function renderStickerChoices() {
  els.emoteStickers.innerHTML = STICKERS.map(
    (sticker) => `
      <button class="sticker-choice" type="button" data-sticker-id="${escapeHtml(sticker.id)}"
        aria-label="发送表情包：${escapeHtml(sticker.label)}" title="${escapeHtml(sticker.label)}">
        <img src="./assets/stickers/${escapeHtml(sticker.file)}" alt="${escapeHtml(sticker.alt)}" loading="lazy">
        <span>${escapeHtml(sticker.label)}</span>
      </button>`,
  ).join("");
}

function renderFaceChoices() {
  els.emoteLive.innerHTML = LIVE2D_FACE_ITEMS.map(
    (item) =>
      `<button type="button" data-live-expression="${escapeHtml(item.id)}"
        data-expression-label="${escapeHtml(item.label)}">${escapeHtml(item.label)}</button>`,
  ).join("");
}

function propButtonMarkup(item) {
  const active = live2dRig.persistentProps.has(item.id);
  return `<button class="${active ? "is-on" : ""}" type="button" data-live-prop="${escapeHtml(
    item.id,
  )}" aria-pressed="${active}">${escapeHtml(item.label)}</button>`;
}

function renderPropChoices() {
  els.emoteProps.innerHTML = LIVE2D_PROP_ITEMS.map(propButtonMarkup).join("");
  els.emoteScenes.innerHTML = LIVE2D_SCENE_ITEMS.map(propButtonMarkup).join("");
}

function renderActionChoices() {
  els.emoteActions.innerHTML = LIVE2D_ACTION_ITEMS.map(
    (item) =>
      `<button type="button" data-live-action="${escapeHtml(item.id)}">${escapeHtml(
        item.label,
      )}</button>`,
  ).join("");
}

function setEmoteTab(tab) {
  document.querySelectorAll("[data-emote-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.emoteTab === tab);
  });
  els.emoteLive.hidden = tab !== "live";
  els.emoteProps.hidden = tab !== "props";
  els.emoteScenes.hidden = tab !== "scenes";
  els.emoteActions.hidden = tab !== "actions";
  els.emoteStickers.hidden = tab !== "stickers";
  if (tab === "props" || tab === "scenes") renderPropChoices();
}

function setSkillMode(mode) {
  const config = mode ? SKILL_MODES[mode] : null;
  ui.skillMode = config ? mode : null;
  if (config) {
    els.skillModeBanner.hidden = false;
    els.skillModeLabel.textContent = `技能 · ${config.label}`;
    els.chatInput.placeholder = config.placeholder;
    els.companion.classList.add("is-skill-mode");
    els.chatSuggestions.hidden = true;
    els.chatSkillSuggestions.hidden = true;
    els.chatSkillToggle.classList.add("is-active");
    setTimeout(() => els.chatInput.focus(), 80);
  } else {
    els.skillModeBanner.hidden = true;
    els.companion.classList.remove("is-skill-mode");
    els.chatInput.placeholder = "告诉本鱼：明天下午 3 点写论文 1 小时…";
    els.chatSuggestions.hidden = false;
    els.chatSkillSuggestions.hidden = true;
    els.chatSkillToggle.classList.remove("is-active");
  }
}

function proactiveIntervalMs() {
  const minutes = Math.max(
    1,
    Math.min(60, Number(state.settings.proactiveIntervalMin) || 5),
  );
  return minutes * 60_000;
}

function scheduleProactiveChat(delayMs = proactiveIntervalMs()) {
  clearTimeout(ui.proactiveTimer);
  ui.proactiveTimer = null;
  if (state.settings.proactiveEnabled === false) return;
  ui.proactiveTimer = setTimeout(checkProactiveChat, Math.max(45_000, delayMs));
}

function quietHoursNow() {
  if (state.settings.quietHoursEnabled === false) return false;
  const hour = new Date().getHours();
  return hour >= 23 || hour < 8;
}

async function checkProactiveChat() {
  ui.proactiveTimer = null;
  if (state.settings.proactiveEnabled === false) return;
  if (document.visibilityState !== "visible") {
    scheduleProactiveChat(60_000);
    return;
  }
  if (quietHoursNow()) {
    scheduleProactiveChat(30 * 60_000);
    return;
  }
  if (
    ui.typing ||
    ui.skillMode ||
    ui.proactiveBusy ||
    els.modalRoot.classList.contains("is-open")
  ) {
    scheduleProactiveChat(60_000);
    return;
  }
  const messages = activeMessages();
  const last = messages[messages.length - 1];
  if (last?.role === "assistant" && last.proactive) {
    scheduleProactiveChat();
    return;
  }
  const elapsed = Date.now() - ui.lastActivityAt;
  const intervalMs = proactiveIntervalMs();
  if (elapsed < intervalMs * 0.8) {
    scheduleProactiveChat(intervalMs - elapsed);
    return;
  }
  const chance = Math.max(0.05, Math.min(0.95, Number(state.settings.proactiveChance) || 0.35));
  if (Math.random() > chance) {
    scheduleProactiveChat();
    return;
  }
  await triggerProactiveMessage();
}

async function triggerProactiveMessage({ manual = false } = {}) {
  if (ui.proactiveBusy) return;
  if (!manual && state.settings.proactiveEnabled === false) return;
  ui.proactiveBusy = true;
  if (manual) toggleConversationPanel(false);
  const activitySnapshot = ui.lastActivityAt;
  let response;
  try {
    if (ui.remoteConfigured) {
      response = await requestRemoteAssistant(PROACTIVE_TRIGGER, { forceChatOnly: true });
    } else {
      response = {
        reply: PROACTIVE_LINES[Math.floor(Math.random() * PROACTIVE_LINES.length)],
        actions: [],
        expression: null,
        sticker: null,
        remote: false,
      };
    }
  } catch {
    response = {
      reply: PROACTIVE_LINES[Math.floor(Math.random() * PROACTIVE_LINES.length)],
      actions: [],
      expression: null,
      sticker: null,
      remote: false,
    };
  }

  if (!manual && ui.lastActivityAt !== activitySnapshot) {
    ui.proactiveBusy = false;
    scheduleProactiveChat();
    return;
  }

  const autoSticker = STICKERS.find((sticker) => sticker.id === response.sticker);
  appendChatMessage({
    id: uid("msg"),
    role: "assistant",
    text: response.reply,
    proactive: true,
    expression: response.expression || null,
    at: new Date().toISOString(),
    proposals: [],
  });
  if (autoSticker) {
    appendChatMessage({
      id: uid("msg"),
      role: "assistant",
      kind: "sticker",
      text: "",
      proactive: true,
      sticker: {
        src: `./assets/stickers/${autoSticker.file}`,
        alt: autoSticker.alt,
        label: autoSticker.label,
      },
      at: new Date(Date.now() + 1).toISOString(),
      proposals: [],
    });
  }
  state.settings.proactiveLastAt = Date.now();
  save();
  renderChat();
  if (ui.view === "today") {
    speakAsPet(response.reply.slice(0, 60), 7200);
    applyLive2DPerformance(response);
    if (autoSticker) {
      playLive2DExpression(autoSticker.expression);
      playLive2DMotion("aidale");
      resetExpressionSoon(4300);
    }
  } else {
    showToast("大肥鱼想跟你说句话，点「大肥鱼」回来看看。");
  }
  ui.proactiveBusy = false;
  scheduleProactiveChat();
}

function toggleEmotePanel(force) {
  const shouldOpen = typeof force === "boolean" ? force : els.emotePanel.hidden;
  els.emotePanel.hidden = !shouldOpen;
  els.openEmotePanel.setAttribute("aria-expanded", String(shouldOpen));
  if (shouldOpen) {
    toggleConversationPanel(false);
    renderFaceChoices();
    renderPropChoices();
    renderActionChoices();
    renderStickerChoices();
    requestAnimationFrame(() => {
      els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    });
  }
}

function renderConversationList() {
  const conversations = [...state.conversations].sort(
    (left, right) => new Date(right.updatedAt) - new Date(left.updatedAt),
  );
  els.conversationList.innerHTML = conversations
    .map((conversation) => {
      const date = new Date(conversation.updatedAt);
      const timeLabel = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
        date.getDate(),
      ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes(),
      ).padStart(2, "0")}`;
      return `
        <button class="conversation-item ${
          conversation.id === state.activeConversationId ? "is-active" : ""
        }" type="button" data-conversation-id="${escapeHtml(conversation.id)}">
          <strong>${escapeHtml(conversation.title || "未命名对话")}</strong>
          <span>${timeLabel}</span>
        </button>`;
    })
    .join("");
}

function toggleConversationPanel(force) {
  const shouldOpen = typeof force === "boolean" ? force : els.conversationPanel.hidden;
  els.conversationPanel.hidden = !shouldOpen;
  els.openConversationPanel.setAttribute("aria-expanded", String(shouldOpen));
  if (shouldOpen) {
    toggleEmotePanel(false);
    renderConversationList();
  }
}

function resetExpressionSoon(delay = 3800) {
  if (!live2dRig.face) return;
  clearTimeout(expressionResetTimer);
  expressionLockUntil = performance.now() + delay;
  live2dRig.faceUntil = expressionLockUntil;
  expressionResetTimer = setTimeout(() => {
    if (performance.now() < expressionLockUntil - 40) return;
    clearTimeout(expressionResetTimer);
    live2dRig.face = null;
    live2dRig.faceUntil = 0;
    delete els.petMascot.dataset.expression;
    delete els.petMascot.dataset.expressionParams;
    updateLive2DMoodLabel();
  }, delay);
}

function sendLiveExpression(expression, label) {
  playLive2DExpression(expression);
  if (EXPRESSION_MOTIONS[expression]) playLive2DMotion(EXPRESSION_MOTIONS[expression]);
  appendChatMessage({
    id: uid("msg"),
    role: "assistant",
    kind: "emote",
    text: label,
    expressionLabel: label,
    at: new Date().toISOString(),
    proposals: [],
  });
  toggleEmotePanel(false);
  save();
  renderChat();
  speakAsPet(`*（${label}）*`, 3200);
  resetExpressionSoon();
}

function sendSticker(stickerId) {
  const sticker = STICKERS.find((item) => item.id === stickerId);
  if (!sticker) return;
  const now = new Date();
  appendChatMessage({
    id: uid("msg"),
    role: "user",
    kind: "sticker",
    text: "",
    sticker: {
      src: `./assets/stickers/${sticker.file}`,
      alt: sticker.alt,
      label: sticker.label,
    },
    at: now.toISOString(),
    proposals: [],
  });
  save();
  toggleEmotePanel(false);
  renderChat();
  playLive2DExpression(sticker.expression);
  playLive2DMotion("aidale");
  setTimeout(() => {
    appendChatMessage({
      id: uid("msg"),
      role: "assistant",
      text: STICKER_REACTIONS[Math.floor(Math.random() * STICKER_REACTIONS.length)],
      at: new Date().toISOString(),
      proposals: [],
    });
    save();
    renderChat();
    resetExpressionSoon(2600);
  }, 520);
}

function renderProposalCard(messageId, proposal) {
  const danger = proposal.risk === "high";
  const plan = proposal.type === "create_plan";
  const riskLabel = danger ? "需二次确认" : proposal.risk === "low" ? "轻量操作" : "待确认";
  const details = Array.isArray(proposal.details) ? proposal.details : [];
  const items = Array.isArray(proposal.items) ? proposal.items : [];
  const pending = proposal.status === "pending";
  const confirmed = proposal.status === "confirmed";
  const rejected = proposal.status === "rejected";
  const undone = proposal.status === "undone";

  return `
    <article class="proposal-card ${danger ? "is-danger" : ""} ${plan ? "is-plan" : ""}">
      <div class="proposal-head">
        <strong>${escapeHtml(proposal.eyebrow)}</strong>
        <span class="proposal-risk">${riskLabel}</span>
      </div>
      <div class="proposal-body">
        <p>${escapeHtml(proposal.title)}</p>
        <div class="proposal-details">
          ${details
            .map(
              ([label, value]) => `
                <div class="proposal-detail">
                  <span>${escapeHtml(label)}</span>
                  <span>${escapeHtml(value)}</span>
                </div>`,
            )
            .join("")}
        </div>
        ${
          items.length
            ? `<div class="proposal-items">${items
                .map((item) => `<span>· ${escapeHtml(item)}</span>`)
                .join("")}</div>`
            : ""
        }
      </div>
      ${
        pending
          ? `<div class="proposal-actions">
              <button class="proposal-action" type="button" data-chat-action="cancel"
                data-message-id="${escapeHtml(messageId)}" data-proposal-id="${escapeHtml(proposal.id)}">先不要</button>
              <button class="proposal-action ${danger ? "danger" : "primary"}" type="button" data-chat-action="confirm"
                data-message-id="${escapeHtml(messageId)}" data-proposal-id="${escapeHtml(proposal.id)}">
                ${danger ? "确认删除" : "确认写入"}
              </button>
            </div>`
          : `<div class="proposal-status">
              <span>${
                confirmed
                  ? "已写入。刚刚那张卡现在算数了。"
                  : rejected
                    ? "已取消，没有改动任何数据。"
                    : undone
                      ? "已撤销，数据恢复原样。"
                      : "这张卡已经过期。"
              }</span>
              ${
                confirmed
                  ? `<button class="undo-button" type="button" data-chat-action="undo"
                      data-message-id="${escapeHtml(messageId)}" data-proposal-id="${escapeHtml(
                        proposal.id,
                      )}">撤销</button>`
                  : ""
              }
            </div>`
      }
    </article>`;
}

function createProposals(actions) {
  return (actions || [])
    .map((action) => {
      const described = describeAction(action, state);
      if (!described) return null;
      return {
        ...described,
        id: uid("proposal"),
        status: "pending",
        createdAt: new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

function toLocalIsoString(date) {
  const pad = (value) => String(value).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
  const offsetRemainder = Math.abs(offsetMinutes) % 60;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(offsetHours)}:${pad(
    offsetRemainder,
  )}`;
}

function currentRemoteContext(enableSkill, currentText = "") {
  const now = new Date();
  const today = toDateKey(now);
  const horizon = toDateKey(addDays(now, 14));
  const historyMessages = activeMessages().filter((message) => {
    const text = String(message.text || "").trim();
    return text && message.kind !== "emote" && message.kind !== "sticker";
  });
  const latestHistory = historyMessages[historyMessages.length - 1];
  if (
    currentText &&
    latestHistory?.role === "user" &&
    String(latestHistory.text || "").trim() === currentText.trim()
  ) {
    historyMessages.pop();
  }
  const upcomingTasks = enableSkill
    ? state.tasks
        .filter((task) => task.dateKey >= today && task.dateKey <= horizon)
        .sort((left, right) => taskDateTimeForContext(left) - taskDateTimeForContext(right))
        .slice(0, 80)
    : [];
  return {
    now: toLocalIsoString(now),
    today,
    scheduleRange: enableSkill ? { start: today, end: horizon } : null,
    skillEnabled: enableSkill,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
    identity: {
      userName: state.settings.userName || "主人",
      petName: state.settings.petName || "大肥鱼",
    },
    history: historyMessages.slice(-MAX_CONTEXT_MESSAGES).map((message) => ({
      role: message.role,
      text: String(message.text).slice(0, MAX_CONTEXT_MESSAGE_CHARS),
    })),
    tasks: upcomingTasks.map((task) => ({
      id: task.id,
      title: task.title,
      dateKey: task.dateKey,
      start: task.start,
      duration: task.duration,
      done: task.done,
      priority: task.priority,
    })),
    plans: enableSkill
      ? state.plans
          .filter((plan) => plan.status === "active")
          .map((plan) => ({
            id: plan.id,
            title: plan.title,
            items: plan.items.map((item) => ({
              label: item.label,
              targetRounds: item.targetRounds,
              completedRounds: item.completedRounds,
            })),
          }))
      : [],
  };
}

async function requestRemoteAssistant(text, { forceChatOnly = false } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const enableSkill = !forceChatOnly && Boolean(ui.skillMode);
  const sessionKey = sessionStorage.getItem(SESSION_API_KEY) || "";
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionKey ? { "x-deepseek-key": sessionKey } : {}),
      },
      body: JSON.stringify({
        message: text,
        context: currentRemoteContext(enableSkill, text),
        enableSkill,
        personaPrompt: state.settings.customPersonaPrompt || "",
        model: state.settings.aiModel || "deepseek-chat",
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
    const data = await response.json();
    if (!data || typeof data.reply !== "string" || !data.reply.trim()) {
      throw new Error("Empty AI response");
    }
    return {
      reply: data.reply.trim(),
      actions: normalizeRemoteActions(data.actions, state),
      expression: data.expression || null,
      motion: data.motion || null,
      props: Array.isArray(data.props) ? data.props : [],
      sticker: data.sticker || null,
      remote: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkRemoteMode() {
  const sessionKey = sessionStorage.getItem(SESSION_API_KEY) || "";
  try {
    const response = await fetch("/api/status", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return;
    const data = await response.json();
    ui.remoteConfigured = Boolean(data.configured || sessionKey);
    ui.remoteModel = sessionKey
      ? state.settings.aiModel || "deepseek-chat"
      : data.model || "local-demo";
    ui.apiSource = data.source || "none";
    ui.baseUrlLabel = data.baseUrlLabel || "";
    ui.deployment = data.deployment || "local";
    applyRemoteState();
  } catch {
    ui.remoteConfigured = Boolean(sessionKey);
    ui.remoteModel = state.settings.aiModel || "deepseek-chat";
    applyRemoteState();
  }
}

function applyRemoteState() {
  els.aiModePill.classList.toggle("is-ai", ui.remoteConfigured);
  els.aiModePill.querySelector("span:last-child").textContent = ui.remoteConfigured
    ? "在线"
    : "本地";
  els.chatModeNote.innerHTML = ui.remoteConfigured
    ? `<span class="status-dot"></span><span>${escapeHtml(ui.remoteModel)} · 所有写入仍需你确认</span>`
    : `<span class="status-dot"></span><span>本地理解 · 点钥匙接入 DeepSeek API</span>`;
}

function openApiSettingsModal() {
  const configuredText = ui.remoteConfigured
    ? `当前已连接 ${ui.remoteModel}${sessionStorage.getItem(SESSION_API_KEY) ? "（当前标签页输入）" : "（服务端环境变量）"}`
    : "当前使用本地理解。配置后，对话会交给 DeepSeek，写入仍需确认。";
  openModal(`
    <div class="modal-card api-modal">
      <div class="modal-head">
        <div>
          <p class="card-kicker">DEEPSEEK CONNECTION</p>
          <h2>接入 DeepSeek</h2>
          <p>${escapeHtml(configuredText)}</p>
        </div>
        <button class="icon-button small" type="button" data-modal-close aria-label="关闭">
          ${icon("close")}
        </button>
      </div>
      <div class="api-local-note">
        <span class="status-dot"></span>
        <p>Key 只保存在当前标签页的 <code>sessionStorage</code>，关闭标签页后失效；不会写入仓库、localStorage 或导出文件。</p>
      </div>
      <form class="task-form" id="api-form">
        <label class="field">
          <span>API Key</span>
          <input name="apiKey" type="password" autocomplete="off" spellcheck="false"
            placeholder="${ui.remoteConfigured ? "输入新 Key 才会替换当前连接" : "sk-..."}" required>
        </label>
        <label class="field">
          <span>模型</span>
          <input name="model" type="text" autocomplete="off" value="${escapeHtml(
            ui.remoteConfigured ? ui.remoteModel : "deepseek-chat",
          )}" placeholder="deepseek-chat" required>
        </label>
        <p class="field-note">Base URL 由服务端 <code>.env</code> 配置；前端不能把 Key 转发到任意地址。</p>
        <div class="form-actions">
          <button class="quiet-button" type="button" data-modal-close>取消</button>
          <button class="primary-button compact" type="submit">验证并连接</button>
        </div>
      </form>
    </div>`);

  const form = document.getElementById("api-form");
  const submit = form.querySelector('button[type="submit"]');
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const apiKey = String(formData.get("apiKey") || "").trim();
    const model = String(formData.get("model") || "deepseek-chat").trim();
    if (!apiKey) {
      showToast("请先填入 API Key。");
      return;
    }
    submit.disabled = true;
    submit.textContent = "正在验证…";
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, model }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "API 配置失败。");
      }
      ui.remoteConfigured = Boolean(data.configured);
      ui.remoteModel = data.model || model;
      ui.apiSource = "runtime";
      ui.baseUrlLabel = data.baseUrlLabel || "";
      sessionStorage.setItem(SESSION_API_KEY, apiKey);
      state.settings.aiModel = model;
      save();
      applyRemoteState();
      form.reset();
      closeModal();
      showToast("DeepSeek 已连接，本鱼换好脑子了。");
    } catch (error) {
      submit.disabled = false;
      submit.textContent = "验证并连接";
      showToast(error.message || "连接失败，确认本机 local-server.mjs 正在运行。");
    }
  });
}

async function sendChatMessage(rawText, { clearInput = false, forceChatOnly = false } = {}) {
  const text = String(rawText || "").trim();
  if (!text || ui.typing) return;

  appendChatMessage({
    id: uid("msg"),
    role: "user",
    text,
    at: new Date().toISOString(),
    proposals: [],
  });
  save();
  ui.typing = true;
  if (clearInput) {
    els.chatInput.value = "";
    resizeChatInput();
  }
  renderChat();

  let response;
  let usedFallbackNote = false;
  if (ui.remoteConfigured) {
    try {
      response = await requestRemoteAssistant(text, { forceChatOnly });
    } catch (error) {
      console.warn("Remote assistant failed, using local intent parser.", error);
      response = localAssistantReply(text, state, {
        enableSkill: !forceChatOnly && Boolean(ui.skillMode),
      });
      usedFallbackNote = true;
    }
  } else {
    await new Promise((resolve) => setTimeout(resolve, 420));
    response = localAssistantReply(text, state, {
      enableSkill: !forceChatOnly && Boolean(ui.skillMode),
    });
  }

  const proposals = createProposals(response.actions || []);
  const displayReply = response.remote
    ? response.reply
    : response.reply.replaceAll("本鲸", "本鱼");
  const autoExpression = response.remote ? response.expression : null;
  const autoSticker = response.remote
    ? STICKERS.find((sticker) => sticker.id === response.sticker)
    : null;
  appendChatMessage({
    id: uid("msg"),
    role: "assistant",
    text: displayReply,
    expression: autoExpression || null,
    at: new Date().toISOString(),
    proposals,
  });
  if (autoSticker) {
    appendChatMessage({
      id: uid("msg"),
      role: "assistant",
      kind: "sticker",
      text: "",
      sticker: {
        src: `./assets/stickers/${autoSticker.file}`,
        alt: autoSticker.alt,
        label: autoSticker.label,
      },
      at: new Date(Date.now() + 1).toISOString(),
      proposals: [],
    });
  }
  ui.typing = false;
  save();
  renderChat();
  renderProposalPrompt(proposals.length);
  speakAsPet(displayReply.slice(0, 50), 6400);
  applyLive2DPerformance({
    expression: autoExpression,
    motion: response.motion,
    props: response.props,
  });
  if (autoSticker) {
    playLive2DExpression(autoSticker.expression);
    playLive2DMotion("aidale");
    resetExpressionSoon(4200);
  }
  if (usedFallbackNote) {
    showToast("DeepSeek 没接上，这次先用本地理解。");
  }
  scheduleProactiveChat();
}

function renderProposalPrompt(count) {
  if (!count) {
    setPetMood(state.timer.status === "running" ? "focus" : "idle");
    return;
  }
  setPetMood("idle");
}

async function confirmProposal(messageId, proposalId) {
  const message = activeMessages().find((item) => item.id === messageId);
  const proposal = message?.proposals?.find((item) => item.id === proposalId);
  if (!message || !proposal || proposal.status !== "pending") return;

  if (proposal.risk === "high") {
    const confirmed = await confirmDialog({
      title: `真的要${proposal.type === "delete_plan" ? "删掉这条航线" : "删除这件事"}吗？`,
      message: `「${proposal.title}」会从当前数据中移除。${
        proposal.type === "delete_plan" ? "已完成番茄与统计会保留。" : "该操作会立刻生效，可以随后撤销。"
      }`,
      confirmLabel: "确认删除",
      danger: true,
    });
    if (!confirmed) return;
  }

  if (proposal.type === "start_focus" && (state.timer.status === "running" || state.timer.status === "paused")) {
    setView("focus", { preserveScroll: true });
    showToast("已经有一条鱼在游了，先回到当前专注。");
    return;
  }

  let undo = null;
  if (proposal.type === "create_task") {
    const task = {
      id: uid("task"),
      ...proposal.payload,
      done: false,
      createdAt: new Date().toISOString(),
    };
    state.tasks.push(task);
    undo = { type: "remove_task", taskId: task.id };
    showToast("日程已经放进鱼缸。");
  } else if (proposal.type === "delete_task") {
    const task = state.tasks.find((item) => item.id === proposal.payload.taskId);
    if (task) {
      state.tasks = state.tasks.filter((item) => item.id !== task.id);
      undo = { type: "restore_task", task };
      showToast("这条日程已经删除。");
    }
  } else if (proposal.type === "update_task") {
    const task = state.tasks.find((item) => item.id === proposal.payload.taskId);
    if (task) {
      const snapshot = { ...task };
      Object.assign(task, proposal.payload.patch, {
        updatedAt: new Date().toISOString(),
      });
      undo = { type: "restore_task", task: snapshot };
      showToast("日程已经按新安排改好了。");
    }
  } else if (proposal.type === "create_plan") {
    const previousPlan = activePlan();
    if (previousPlan) previousPlan.status = "paused";
    const items = proposal.payload.items.map((item) => ({
      id: uid("plan-item"),
      label: item.label,
      taskId: item.taskId || null,
      targetRounds: item.rounds || 1,
      completedRounds: 0,
    }));
    const plan = {
      id: uid("plan"),
      title: proposal.payload.title,
      status: "active",
      currentItemId: items[0].id,
      focusMinutes: ui.focusMinutes,
      items,
      createdAt: new Date().toISOString(),
    };
    state.plans.push(plan);
    undo = {
      type: "remove_plan",
      planId: plan.id,
      previousPlanId: previousPlan?.id || null,
    };
    showToast("专注航线已经摆进专注页。");
  } else if (proposal.type === "delete_plan") {
    const plan = state.plans.find((item) => item.id === proposal.payload.planId);
    if (plan) {
      state.plans = state.plans.filter((item) => item.id !== plan.id);
      undo = { type: "restore_plan", plan };
      showToast("专注计划已经取消，番茄记录还在。");
    }
  } else if (proposal.type === "start_focus") {
    startNewFocus({
      durationMin: proposal.payload.durationMin,
      taskId: proposal.payload.taskId,
    });
    undo = { type: "stop_timer", timerId: state.timer.id };
  }

  proposal.status = "confirmed";
  proposal.appliedAt = new Date().toISOString();
  proposal.undo = undo;
  save();
  renderAll();
}

function cancelProposal(messageId, proposalId) {
  const message = activeMessages().find((item) => item.id === messageId);
  const proposal = message?.proposals?.find((item) => item.id === proposalId);
  if (!message || !proposal || proposal.status !== "pending") return;
  proposal.status = "rejected";
  save();
  renderChat();
  showToast("取消了，什么也没改。");
}

function undoProposal(messageId, proposalId) {
  const message = activeMessages().find((item) => item.id === messageId);
  const proposal = message?.proposals?.find((item) => item.id === proposalId);
  if (!message || !proposal || proposal.status !== "confirmed" || !proposal.undo) return;
  const undo = proposal.undo;

  if (undo.type === "remove_task") {
    state.tasks = state.tasks.filter((task) => task.id !== undo.taskId);
  } else if (undo.type === "restore_task") {
    const index = state.tasks.findIndex((task) => task.id === undo.task.id);
    if (index >= 0) state.tasks[index] = undo.task;
    else state.tasks.push(undo.task);
  } else if (undo.type === "remove_plan") {
    state.plans = state.plans.filter((plan) => plan.id !== undo.planId);
    const previousPlan = state.plans.find((plan) => plan.id === undo.previousPlanId);
    if (previousPlan) previousPlan.status = "active";
  } else if (undo.type === "restore_plan") {
    if (!state.plans.some((plan) => plan.id === undo.plan.id)) state.plans.push(undo.plan);
  } else if (undo.type === "stop_timer") {
    if (state.timer.id !== undo.timerId) {
      showToast("这一轮已经发生变化，不能自动撤销了。");
      return;
    }
    resetTimerToIdle();
  }

  proposal.status = "undone";
  save();
  renderAll();
  showToast("撤销好了，数据恢复原样。");
}

function defaultTaskStart(dateKey) {
  if (dateKey !== toDateKey()) return "09:30";
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.ceil((current + 10) / 30) * 30;
  if (rounded >= 23 * 60) return "09:30";
  return minutesToTime(Math.max(8 * 60, rounded));
}

function openNameModal() {
  const userName = state.settings.userName || "主人";
  const petName = state.settings.petName || "大肥鱼";
  openModal(`
    <div class="modal-card">
      <div class="modal-head">
        <div>
          <p class="card-kicker">CALL EACH OTHER</p>
          <h2>换个称呼吧</h2>
          <p>名字只保存在这台设备里，随时都能改。</p>
        </div>
        <button class="icon-button small" type="button" data-modal-close aria-label="关闭">
          ${icon("close")}
        </button>
      </div>
      <form class="task-form" id="name-form">
        <div class="form-row">
          <label class="field">
            <span>${escapeHtml(petName)}怎么称呼你</span>
            <input name="userName" type="text" maxlength="12" required value="${escapeHtml(userName)}">
          </label>
          <label class="field">
            <span>你怎么称呼她</span>
            <input name="petName" type="text" maxlength="12" required value="${escapeHtml(petName)}">
          </label>
        </div>
        <p class="field-note">例如：你叫「主人」，她叫「大肥鱼」或「鲸宝」。</p>
        <div class="form-actions">
          <button class="quiet-button" type="button" data-modal-close>先不改</button>
          <button class="primary-button compact" type="submit">保存称呼</button>
        </div>
      </form>
    </div>`);
  const form = document.getElementById("name-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const nextUserName = String(formData.get("userName") || "").trim().slice(0, 12);
    const nextPetName = String(formData.get("petName") || "").trim().slice(0, 12);
    if (!nextUserName || !nextPetName) {
      showToast("两个名字都留一点字给本鱼吧。");
      return;
    }
    state.settings.userName = nextUserName;
    state.settings.petName = nextPetName;
    save();
    closeModal();
    renderTopbar();
    renderChatHeader();
    speakAsPet("名字换好啦。以后就这么叫。", 4200);
    showToast("称呼已经更新。");
  });
  requestAnimationFrame(() => form.elements.userName?.focus());
}

function openTaskModal({ taskId = "", dateKey = "", start = "" } = {}) {
  const task = taskId ? state.tasks.find((item) => item.id === taskId) : null;
  const targetDate = task?.dateKey || dateKey || (ui.view === "schedule" ? toDateKey(ui.scheduleAnchor) : toDateKey());
  const targetStart = task?.start || start || defaultTaskStart(targetDate);
  const selectedTone = task?.tone || chooseTone(`${targetDate}-${targetStart}`);
  const toneButtons = Object.entries(TASK_TONES)
    .map(
      ([key, tone]) => `
        <button class="tone-option ${key === selectedTone ? "is-active" : ""}" type="button"
          data-tone="${key}" style="--tone-color:${tone.color}">
          ${tone.label}
        </button>`,
    )
    .join("");

  openModal(`
    <div class="modal-card">
      <div class="modal-head">
        <div>
          <p class="card-kicker">${task ? "EDIT THE LITTLE THING" : "ONE SMALL THING"}</p>
          <h2>${task ? "改一改这件事" : "往今天放一件小事"}</h2>
          <p>不用写得很完整，能开始就够了。</p>
        </div>
        <button class="icon-button small modal-close" type="button" data-modal-close aria-label="关闭">
          ${icon("close")}
        </button>
      </div>
      <form class="task-form" id="task-form">
        <label class="field">
          <span>要做什么</span>
          <input name="title" type="text" maxlength="120" required autocomplete="off"
            value="${escapeHtml(task?.title || "")}" placeholder="比如：写论文第二章的提纲">
        </label>
        <div class="form-row">
          <label class="field">
            <span>哪一天</span>
            <input name="dateKey" type="date" required value="${escapeHtml(targetDate)}">
          </label>
          <label class="field">
            <span>开始时间</span>
            <input name="start" type="time" required value="${escapeHtml(targetStart)}">
          </label>
        </div>
        <div class="form-row">
          <label class="field">
            <span>预计多久（分钟）</span>
            <input name="duration" type="number" min="5" max="480" step="5" required
              value="${Number(task?.duration || 25)}">
          </label>
          <label class="field">
            <span>重要程度</span>
            <select name="priority">
              <option value="low" ${task?.priority === "low" ? "selected" : ""}>不急，稳稳做</option>
              <option value="medium" ${!task || task.priority === "medium" ? "selected" : ""}>普通</option>
              <option value="high" ${task?.priority === "high" ? "selected" : ""}>有点重要</option>
            </select>
          </label>
        </div>
        <div class="field">
          <span>给它一个颜色</span>
          <div class="tone-options" id="tone-options">${toneButtons}</div>
          <input type="hidden" name="tone" value="${selectedTone}">
        </div>
        <label class="field">
          <span>留一句话给未来的自己（可选）</span>
          <textarea name="notes" maxlength="2000" placeholder="比如：先列三级标题，不追求句子漂亮。">${escapeHtml(
            task?.notes || "",
          )}</textarea>
        </label>
        <div class="form-actions">
          ${
            task
              ? `<button class="quiet-button delete-task-button" type="button" data-delete-task="${escapeHtml(
                  task.id,
                )}">${icon("trash")} 删除</button>`
              : ""
          }
          <button class="quiet-button" type="button" data-modal-close>先不写</button>
          <button class="primary-button compact" type="submit">${task ? "保存修改" : "放进日程"}</button>
        </div>
      </form>
    </div>`);

  const form = document.getElementById("task-form");
  form.addEventListener("click", (event) => {
    const toneButton = event.target.closest("[data-tone]");
    if (!toneButton) return;
    form.querySelectorAll("[data-tone]").forEach((button) => button.classList.remove("is-active"));
    toneButton.classList.add("is-active");
    form.elements.tone.value = toneButton.dataset.tone;
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      title: String(formData.get("title") || "").trim(),
      dateKey: String(formData.get("dateKey") || ""),
      start: String(formData.get("start") || ""),
      duration: Math.max(5, Math.min(480, Number(formData.get("duration")) || 25)),
      priority: String(formData.get("priority") || "medium"),
      tone: String(formData.get("tone") || "sea"),
      notes: String(formData.get("notes") || "").trim(),
    };
    if (!payload.title || !payload.dateKey || !payload.start) {
      showToast("还差一点信息，本鱼没法替你摆进日程。");
      return;
    }
    if (task) {
      Object.assign(task, payload);
    } else {
      state.tasks.push({
        id: uid("task"),
        ...payload,
        done: false,
        createdAt: new Date().toISOString(),
      });
    }
    closeModal();
    save();
    renderAll();
    showToast(task ? "改好了，时间重新记在鱼缸边上了。" : "放进去了。先做一点，不用做完。");
  });

  form.querySelector("[data-delete-task]")?.addEventListener("click", () => {
    const id = form.querySelector("[data-delete-task]").dataset.deleteTask;
    closeModal();
    confirmDeleteTask(id);
  });

  requestAnimationFrame(() => form.elements.title?.focus());
}

function openModal(content) {
  els.modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-close></div>${content}`;
  els.modalRoot.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  els.modalRoot.classList.remove("is-open");
  els.modalRoot.innerHTML = "";
  document.body.style.overflow = "";
}

function confirmDialog({ title, message, confirmLabel = "确认", danger = true }) {
  return new Promise((resolve) => {
    openModal(`
      <div class="modal-card confirm-card">
        <div class="confirm-symbol">${icon(danger ? "trash" : "stop")}</div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
        <div class="confirm-actions">
          <button class="quiet-button" type="button" data-confirm-cancel>再想想</button>
          <button class="danger-button ${danger ? "danger-button" : "primary-button"}" type="button" data-confirm-ok>
            ${escapeHtml(confirmLabel)}
          </button>
        </div>
      </div>`);
    const finish = (value) => {
      closeModal();
      resolve(value);
    };
    els.modalRoot.querySelector("[data-confirm-cancel]").addEventListener("click", () => finish(false));
    els.modalRoot.querySelector("[data-confirm-ok]").addEventListener("click", () => finish(true));
    els.modalRoot.querySelector(".modal-backdrop").addEventListener("click", () => finish(false));
    requestAnimationFrame(() => els.modalRoot.querySelector("[data-confirm-cancel]")?.focus());
  });
}

function showToast(message, { actionLabel = "", onAction = null, duration = 4300 } = {}) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `${icon("spark")}<span>${escapeHtml(message)}</span>${
    actionLabel ? `<button type="button">${escapeHtml(actionLabel)}</button>` : ""
  }`;
  els.toastRoot.appendChild(toast);
  if (actionLabel && onAction) {
    toast.querySelector("button").addEventListener("click", () => {
      onAction();
      removeToast(toast);
    });
  }
  let timer = setTimeout(() => removeToast(toast), duration);
  toast.addEventListener("mouseenter", () => clearTimeout(timer));
  toast.addEventListener("mouseleave", () => {
    timer = setTimeout(() => removeToast(toast), 1400);
  });
}

function removeToast(toast) {
  if (!toast?.isConnected) return;
  toast.classList.add("is-leaving");
  setTimeout(() => toast.remove(), 210);
}

function toggleTaskDone(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  task.done = !task.done;
  save();
  renderAll();
  if (task.done) {
    showToast("收下一件。完成不是应该，是你真的游到了。");
    setPetMood("happy", 2200);
    speakAsPet("这件收好了。别急着把下一件也扛上。", 4600);
  }
}

async function confirmDeleteTask(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  const confirmed = await confirmDialog({
    title: "要把这件事删掉吗？",
    message: `「${task.title}」会从日程里移除。已完成的专注记录和番茄统计不会受影响。`,
    confirmLabel: "确认删除",
    danger: true,
  });
  if (!confirmed) return;
  state.tasks = state.tasks.filter((item) => item.id !== taskId);
  save();
  renderAll();
  showToast("已经从日程里删除了。", {
    actionLabel: "撤销",
    onAction: () => {
      state.tasks.push(task);
      save();
      renderAll();
      showToast("这件事又回来了。");
    },
  });
}

function fireConfetti() {
  const colors = ["#f47f6c", "#f4c45b", "#71b8b4", "#9bbf95", "#fff0c9"];
  const pieces = Array.from({ length: 34 }, (_, index) => {
    const piece = document.createElement("span");
    piece.className = `celebration-piece ${index % 4 === 0 ? "is-tomato" : ""}`;
    piece.style.setProperty("--start-x", `${8 + Math.random() * 84}%`);
    piece.style.setProperty("--size", `${index % 4 === 0 ? 15 : 5 + Math.random() * 9}px`);
    piece.style.setProperty("--piece-color", colors[index % colors.length]);
    piece.style.setProperty("--drift-x", `${-90 + Math.random() * 180}px`);
    piece.style.setProperty("--rise-y", `${120 + Math.random() * 360}px`);
    piece.style.setProperty("--rotate", `${-240 + Math.random() * 480}deg`);
    piece.style.setProperty("--duration", `${1800 + Math.random() * 1400}ms`);
    piece.style.animationDelay = `${Math.random() * 240}ms`;
    return piece;
  });
  pieces.forEach((piece) => els.celebrationLayer.appendChild(piece));
  setTimeout(() => {
    pieces.forEach((piece) => piece.remove());
  }, 3600);
}

function resizeChatInput() {
  els.chatInput.style.height = "auto";
  els.chatInput.style.height = `${Math.min(88, els.chatInput.scrollHeight)}px`;
}

function speakAsPet(text, duration = 6500) {
  clearTimeout(petSpeechTimer);
  const userName = state.settings.userName || "主人";
  const petName = state.settings.petName || "大肥鱼";
  els.petSpeechText.textContent = String(text)
    .replaceAll("本鲸", "本鱼")
    .replaceAll("{user}", userName)
    .replaceAll("{pet}", petName);
  els.petSpeech.classList.remove("is-hidden");
  petSpeechTimer = setTimeout(() => {
    els.petSpeech.classList.add("is-hidden");
  }, duration);
}

function pickPetLine(lines) {
  const line = lines[Math.floor(Math.random() * lines.length)];
  if (line === els.petSpeechText.textContent && lines.length > 1) {
    return lines[(lines.indexOf(line) + 1) % lines.length];
  }
  return line;
}

function fitLive2DModel() {
  if (!live2dModel || !live2dApp) return;
  const width = live2dApp.screen.width;
  const height = live2dApp.screen.height;
  if (!width || !height) return;
  const modelWidth = Math.max(1, live2dModel.internalModel?.width || live2dModel.width);
  const modelHeight = Math.max(1, live2dModel.internalModel?.height || live2dModel.height);
  const compact = width < 560;
  const scale =
    Math.min(
      (width * (compact ? 0.82 : 0.88)) / modelWidth,
      (height * (compact ? 1.05 : 1.16)) / modelHeight,
    ) * ui.petScale;
  els.petMascot.dataset.modelSize = `${Math.round(modelWidth)}x${Math.round(modelHeight)} / ${scale.toFixed(3)}`;
  live2dModel.scale.set(scale);
  live2dModel.x = width * 0.5 + ui.petOffsetX;
  live2dModel.y = height * 0.56 + ui.petOffsetY;
}

function focusLive2DAt(clientX, clientY, instant = false) {
  if (!live2dReady || !live2dModel || !live2dApp) return;
  const rect = els.petStage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = ((clientX - rect.left) / rect.width) * live2dApp.screen.width;
  const y = ((clientY - rect.top) / rect.height) * live2dApp.screen.height;
  try {
    live2dModel.focus(x, y, instant);
    els.petMascot.dataset.focus = `${Math.round(x)},${Math.round(y)}`;
  } catch {
    // Pointer focus is a non-critical enhancement.
  }
}

function focusLive2DAtCenter() {
  if (!live2dReady || !live2dModel || !live2dApp) return;
  try {
    live2dModel.focus(
      live2dApp.screen.width * 0.5,
      live2dApp.screen.height * 0.42,
    );
    els.petMascot.dataset.focus = "center";
  } catch {
    // The neutral gaze still remains available on the model.
  }
}

function clearLive2DMotionPose() {
  if (!live2dReady || !live2dModel) return;
  const coreModel = live2dModel.internalModel?.coreModel;
  const parameters = coreModel?._model?.parameters;
  if (!coreModel || !parameters) return;
  try {
    live2dModel.internalModel?.motionManager?.stopAllMotions?.();
    for (let index = 0; index < parameters.count; index += 1) {
      const defaultValue = parameters.defaultValues[index];
      if (Number.isFinite(defaultValue)) {
        coreModel.setParameterValueByIndex(index, defaultValue);
      }
    }
    coreModel.saveParameters?.();
  } catch {
    // Returning to the neutral pose is best-effort.
  }
}

function playLive2DMotion(name, durationMs) {
  if (!live2dReady || !live2dModel) return;
  try {
    live2dModel.motion(name);
    els.petMascot.dataset.lastMotion = name;
    els.petMascot.dataset.motionActive = "true";
    clearTimeout(motionResetTimer);
    const duration = Number(durationMs) || (LIVE2D_MOTION_DURATIONS[name] || 1.5) * 1000;
    motionResetTimer = setTimeout(() => {
      els.petMascot.dataset.motionActive = "false";
      clearLive2DMotionPose();
    }, duration + 140);
  } catch (error) {
    console.warn(`Live2D motion unavailable: ${name}`, error);
  }
}

function spawnExpressionEffect(nameOrSymbols) {
  if (!els.petStage) return;
  const symbols = Array.isArray(nameOrSymbols)
    ? nameOrSymbols
    : EXPRESSION_EFFECTS[nameOrSymbols] || ["✦"];
  const layer = document.createElement("div");
  layer.className = "expression-effect";
  layer.dataset.expression = Array.isArray(nameOrSymbols)
    ? "custom"
    : nameOrSymbols;
  layer.innerHTML = symbols
    .map((symbol, index) => {
      const spread = symbols.length > 1 ? index / (symbols.length - 1) : 0.5;
      const left = 26 + spread * 48 + (Math.random() - 0.5) * 12;
      const top = 19 + Math.random() * 34;
      const size = 20 + Math.random() * 22;
      const rotate = -18 + Math.random() * 36;
      return `<span style="--x:${left}%;--y:${top}%;--size:${size}px;--rotate:${rotate}deg;--delay:${index * 90}ms">${symbol}</span>`;
    })
    .join("");
  els.petStage.appendChild(layer);
  els.petStage.classList.remove("has-expression-effect");
  void els.petStage.offsetWidth;
  els.petStage.classList.add("has-expression-effect");
  setTimeout(() => {
    layer.remove();
    if (!els.petStage.querySelector(".expression-effect")) {
      els.petStage.classList.remove("has-expression-effect");
    }
  }, 1900);
}

function setLiveExpressionNow(name) {
  const resolved = resolveLive2DExpression(name);
  const params = LIVE2D_PARAM_MAPS[resolved];
  if (!resolved || !params) return false;
  live2dRig.face = resolved;
  els.petMascot.dataset.expression = resolved;
  els.petMascot.dataset.expressionParams = JSON.stringify(params);
  if (els.liveMoodChip) {
    els.liveMoodChip.querySelector("span:last-child").textContent =
      EXPRESSION_LABELS[resolved] || resolved;
  }
  return true;
}

function playLive2DExpression(name, { duration = 4300, effect = true } = {}) {
  const resolved = resolveLive2DExpression(name);
  if (!resolved) return;
  expressionLockUntil = performance.now() + duration;
  live2dRig.faceUntil = expressionLockUntil;
  setLiveExpressionNow(resolved);
  if (effect) spawnExpressionEffect(resolved);
  resetExpressionSoon(duration);
}

function moodExpression(mood) {
  return {
    happy: "开心兴奋",
    focus: "星星眼",
    sleepy: "闭眼口水",
    comfort: "脸红",
  }[mood];
}

function updateLive2DMoodLabel() {
  if (!els.liveMoodChip) return;
  const labels = {
    idle: "悠闲游着",
    happy: "被摸开心",
    focus: "陪你专注",
    sleepy: "有点打盹",
    comfort: "安静陪着",
  };
  if (live2dRig.face) {
    els.liveMoodChip.querySelector("span:last-child").textContent =
      EXPRESSION_LABELS[live2dRig.face] || live2dRig.face;
    return;
  }
  els.liveMoodChip.querySelector("span:last-child").textContent =
    labels[live2dMood] || labels.idle;
}

function applyLive2DMood(mood) {
  if (!live2dReady || live2dMood === mood) return;
  live2dMood = mood;
  if (!live2dRig.face) updateLive2DMoodLabel();
  if (mood === "happy") playLive2DMotion("aidale");
}

function applyMoodVisual(mood) {
  els.petMascot.dataset.mood = mood;
  applyLive2DMood(mood);
  if (!live2dRig.face) updateLive2DMoodLabel();
}

function propExpression(propId) {
  const item = PROP_ITEM_BY_ID.get(propId);
  return item ? resolveLive2DExpression(item.expr) : null;
}

const LIVE2D_PROP_LINES = {
  glassesRound: "圆框眼镜，像不像认真学习的本鱼？",
  glassesSquare: "方框一戴，本鱼现在很有学问。",
  glassesOval: "椭圆镜片，温柔一点点。",
  glassesSun: "墨镜一戴，谁也不爱。",
  stickerCat: "喵。本鱼现在有猫猫贴纸了。",
  stickerRabbit: "兔兔耳朵，蹦一下。",
  stickerBow: "蝴蝶结。好看也不许一直盯。",
  flower: "脑袋上开花了，心情也开了。",
  ponytail: "扎个单边马尾，干活利索。",
  headband: "发箍戴好，准备认真。",
  whaleHat: "头顶一只小鲸鱼，和本鱼作伴。",
  darkCloth: "深色桌布，今天走高级路线。",
  whaleOnDesk: "小鲸鱼放桌上，陪着本鱼。",
  parfait: "巴菲！这个是本鱼的，别抢。",
  claws: "粉色魔爪，可爱但是会挠人。",
  clawsWhite: "白色魔爪，看起来更厉害了。",
  phone: "手机掏出来了，看看有没有新消息。",
  phoneSkin: "换个手机壳，换个心情。",
};

const LIVE2D_ACTION_LINES = {
  paw: "猫爪左右摆，喵喵喵。",
  catPaw: "爪爪在这里，软的哦。",
  doubleV: "双手比耶，今天也要赢。",
  love: "爱心发射，收好。",
  heartbeat: "扑通扑通……不是因为你，真的。",
  squeeze: "Moe moe Q～再挤要变形了。",
  eraser: "这段擦掉，本鱼重写。",
  undo: "撤回撤回，刚才那句不算。",
  omurice: "蛋包饭，番茄酱画个爱心。",
  selfie: "先别眨眼，本鱼找个角度。",
  selfieQuick: "咔嚓，一秒拍完。",
  splash: "鲸鱼是会喷水的，噗——",
  pointBoard: "点菜板拿好，今天想吃什么？",
  pen: "笔也拿好，本鱼可以开始记了。",
  stretch: "伸个懒腰，鱼鳍都舒展开了。",
  bubble: "咕噜咕噜，吹个泡泡。",
  openLid: "开盖看看，里面没有藏小鱼干。",
  selfieMotion: "来，看镜头。",
  selfieQuickMotion: "快速抓拍一张。",
};

function saveLive2DProps() {
  state.settings.live2dProps = Array.from(live2dRig.persistentProps);
  save();
}

function refreshLive2DPropButtons() {
  if (els.emoteProps && !els.emoteProps.hidden) renderPropChoices();
  if (els.emoteScenes && !els.emoteScenes.hidden) renderPropChoices();
}

function setLive2DProp(propId, force, { silent = false } = {}) {
  const item = PROP_ITEM_BY_ID.get(propId);
  if (!item) return false;
  const enabled =
    typeof force === "boolean" ? force : !live2dRig.persistentProps.has(propId);

  if (enabled) {
    if (item.requires) setLive2DProp(item.requires, true, { silent: true });
    if (item.group) {
      for (const other of PROP_ITEM_BY_ID.values()) {
        if (other.id !== propId && other.group === item.group) {
          live2dRig.persistentProps.delete(other.id);
        }
      }
    }
    for (const clearedId of item.clears || []) {
      live2dRig.persistentProps.delete(clearedId);
    }
    live2dRig.persistentProps.add(propId);
    if (item.motion) playLive2DMotion(item.motion);
  } else {
    live2dRig.persistentProps.delete(propId);
    for (const other of PROP_ITEM_BY_ID.values()) {
      if (other.requires === propId) live2dRig.persistentProps.delete(other.id);
    }
  }

  saveLive2DProps();
  refreshLive2DPropButtons();
  if (!silent) {
    speakAsPet(
      enabled
        ? LIVE2D_PROP_LINES[propId] || `${item.label}，摆好了。`
        : `${item.label}收起来了。`,
      3600,
    );
    if (enabled) spawnExpressionEffect(item.expr || item.label);
  }
  return enabled;
}

function setLive2DTemporaryProp(propId, duration = 7000) {
  if (!PROP_ITEM_BY_ID.has(propId)) return;
  live2dRig.temporaryProps.set(propId, performance.now() + duration);
  refreshLive2DPropButtons();
}

function clearLive2DProps() {
  live2dRig.persistentProps.clear();
  live2dRig.temporaryProps.clear();
  saveLive2DProps();
  refreshLive2DPropButtons();
}

function resetLive2DPetState() {
  clearLive2DProps();
  clearTimeout(expressionResetTimer);
  live2dRig.face = null;
  live2dRig.faceUntil = 0;
  live2dRig.weights.clear();
  expressionLockUntil = 0;
  live2dMood = "";
  delete els.petMascot.dataset.expression;
  delete els.petMascot.dataset.expressionParams;
  delete els.petMascot.dataset.aiProps;
  els.petMascot.dataset.motionActive = "false";
  clearTimeout(motionResetTimer);
  clearLive2DMotionPose();
  updatePetMood();
  updateLive2DMoodLabel();
  speakAsPet("好啦，本子、笔和本鱼都归位了。", 3200);
}

function performLive2DAction(actionId) {
  const action = live2DActionById(actionId);
  if (!action) return;
  const duration = action.duration || 3400;

  if (action.requires) {
    setLive2DTemporaryProp(action.requires, duration + 1400);
    if (action.requires === "phone" && ["selfie", "selfieQuick", "selfieMotion", "selfieQuickMotion"].includes(action.id)) {
      playLive2DMotion("openLid", 900);
      setTimeout(() => playLive2DMotion(action.motion, duration), 420);
    } else if (action.motion) {
      playLive2DMotion(action.motion, duration);
    }
  } else if (action.motion) {
    playLive2DMotion(action.motion, duration);
  }

  if (action.expression) {
    playLive2DExpression(action.expression, {
      duration,
      effect: false,
    });
  }
  if (action.effect) spawnExpressionEffect(action.effect);
  speakAsPet(LIVE2D_ACTION_LINES[action.id] || action.label, 3600);
}

function applyLive2DPerformance(performance = {}) {
  const expression = resolveLive2DExpression(performance.expression);
  const motion = LIVE2D_MOTION_IDS.has(performance.motion) ? performance.motion : null;
  const props = Array.isArray(performance.props)
    ? performance.props.filter((id) => PROP_ITEM_BY_ID.has(id)).slice(0, 3)
    : [];
  if (expression) {
    playLive2DExpression(expression, {
      duration: 5200,
      effect: true,
    });
  }
  for (const propId of props) {
    setLive2DTemporaryProp(propId, 8500);
    const item = PROP_ITEM_BY_ID.get(propId);
    if (item?.motion && !motion) playLive2DMotion(item.motion);
  }
  if (motion) playLive2DMotion(motion);
  if (props.length) els.petMascot.dataset.aiProps = props.join(",");
}

function applyLive2DRig() {
  const coreModel = live2dModel?.internalModel?.coreModel;
  if (!coreModel) return;
  const now = performance.now();
  const dt = Math.min(64, now - (live2dRig.lastFrameAt || now)) / 1000;
  live2dRig.lastFrameAt = now;

  if (
    live2dRig.face &&
    live2dRig.faceUntil &&
    now >= live2dRig.faceUntil
  ) {
    live2dRig.face = null;
    live2dRig.faceUntil = 0;
    delete els.petMascot.dataset.expression;
    delete els.petMascot.dataset.expressionParams;
    updateLive2DMoodLabel();
  }

  for (const [propId, until] of live2dRig.temporaryProps) {
    if (now >= until) live2dRig.temporaryProps.delete(propId);
  }

  const faceExpression =
    live2dRig.face || resolveLive2DExpression(moodExpression(live2dMood));
  const propExpressions = [];
  for (const propId of live2dRig.persistentProps) {
    const expression = propExpression(propId);
    if (expression) propExpressions.push(expression);
  }
  for (const propId of live2dRig.temporaryProps.keys()) {
    const expression = propExpression(propId);
    if (expression) propExpressions.push(expression);
  }

  const targets = new Set();
  if (faceExpression) targets.add(faceExpression);
  propExpressions.forEach((name) => targets.add(name));

  const names = new Set([...live2dRig.weights.keys(), ...targets]);
  for (const name of names) {
    const target = targets.has(name) ? 1 : 0;
    let weight = live2dRig.weights.get(name) || 0;
    const speed = target > weight ? 7 : 11;
    weight += (target - weight) * Math.min(1, Math.max(0, dt * speed));
    if (target === 0 && weight < 0.02) live2dRig.weights.delete(name);
    else live2dRig.weights.set(name, weight);
  }

  const orderedNames = [];
  if (faceExpression) orderedNames.push(faceExpression);
  for (const name of propExpressions) {
    if (!orderedNames.includes(name)) orderedNames.push(name);
  }
  for (const name of live2dRig.weights.keys()) {
    if (!orderedNames.includes(name)) orderedNames.push(name);
  }

  const delta = new Map();
  const claimed = new Set();
  for (const name of orderedNames) {
    const weight = live2dRig.weights.get(name) || 0;
    if (weight <= 0.001) continue;
    const params = LIVE2D_PARAM_MAPS[name];
    if (!params) continue;
    for (const [id, value] of Object.entries(params)) {
      if (claimed.has(id)) continue;
      claimed.add(id);
      delta.set(id, (delta.get(id) || 0) + Number(value) * weight);
    }
  }

  delta.forEach((value, id) => {
    if (Math.abs(value) < 0.001) return;
    try {
      coreModel.addParameterValueById(id, value);
    } catch {
      // Ignore parameters that are absent in alternate model builds.
    }
  });
  els.petMascot.dataset.rigActive = String(targets.size);
  els.petMascot.dataset.rigFace = faceExpression || "";
}

async function initLive2D() {
  try {
    if (!window.PIXI?.live2d?.Live2DModel) {
      throw new Error("Live2D runtime unavailable");
    }
    live2dApp = new PIXI.Application({
      view: els.live2dCanvas,
      resizeTo: els.petMascot,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });
    live2dModel = await PIXI.live2d.Live2DModel.from(
      "./assets/live2d/c_0120.model3.json",
      { autoInteract: false },
    );
    live2dModel.anchor.set(0.5, 0.5);
    live2dApp.stage.addChild(live2dModel);
    fitLive2DModel();
    live2dReady = true;
    live2dModel.internalModel?.on?.("beforeModelUpdate", applyLive2DRig);
    els.petMascot.classList.add("is-ready");
    applyMoodVisual(els.petMascot.dataset.mood || "idle");

    live2dResizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        live2dApp?.resize?.();
        fitLive2DModel();
      });
    });
    live2dResizeObserver.observe(els.petMascot);
    window.__dafiyuLive2D = { app: live2dApp, model: live2dModel };
  } catch (error) {
    console.warn("Live2D failed to load; using static fallback.", error);
    live2dReady = false;
    els.live2dCanvas.hidden = true;
    els.live2dFallback.hidden = false;
    els.petMascot.classList.add("is-fallback", "is-ready");
    if (els.live2dLoader) {
      els.live2dLoader.innerHTML = "<span>鱼缸信号不好，先用静态立绘陪你。</span>";
    }
  }
}

function setPetMood(mood, duration = 0) {
  ui.petMoodOverride = duration ? mood : null;
  applyMoodVisual(mood);
  clearTimeout(petMoodTimer);
  if (duration) {
    petMoodTimer = setTimeout(() => {
      ui.petMoodOverride = null;
      updatePetMood();
    }, duration);
  }
}

function updatePetMood() {
  if (ui.petMoodOverride) {
    applyMoodVisual(ui.petMoodOverride);
    return;
  }
  if (state.timer.status === "running" || state.timer.status === "paused") {
    applyMoodVisual(state.timer.mode === "break" ? "idle" : "focus");
    return;
  }
  const hour = new Date().getHours();
  applyMoodVisual(hour >= 23 || hour < 6 ? "sleepy" : "idle");
}

function patPet() {
  els.petMascot.classList.remove("is-petting");
  els.petStage.classList.add("is-petting");
  void els.petMascot.offsetWidth;
  els.petMascot.classList.add("is-petting");
  playLive2DMotion("aidale");
  playLive2DExpression("blush");
  setPetMood("happy", 1600);
  setTimeout(() => {
    els.petMascot.classList.remove("is-petting");
    els.petStage.classList.remove("is-petting");
  }, 1000);
  speakAsPet(pickPetLine(PET_PAT_LINES), 4600);
}

function pokePet() {
  const lines = [
    "喂，戳哪儿呢，本鱼还没翻肚皮。",
    "别戳了别戳了，再戳要漏气了。",
    "你这手怎么这么闲？去写两行字。",
    "本鱼在这儿陪聊，不是按钮。",
  ];
  playLive2DMotion("bubble");
  playLive2DExpression("sweat");
  setPetMood("happy", 1200);
  speakAsPet(pickPetLine(lines), 4200);
}

function handlePetTap(event) {
  if (performance.now() < ui.suppressPetTapUntil) return;
  const now = performance.now();
  if (now - (handlePetTap.lastAt || 0) < 160) return;
  handlePetTap.lastAt = now;
  const rect = els.petMascot.getBoundingClientRect();
  const relativeY = rect.height ? (event.clientY - rect.top) / rect.height : 0.5;
  let hits = [];
  if (live2dReady && live2dModel && live2dApp) {
    const x = ((event.clientX - rect.left) / rect.width) * live2dApp.screen.width;
    const y = ((event.clientY - rect.top) / rect.height) * live2dApp.screen.height;
    try {
      hits = live2dModel.hitTest(x, y);
    } catch {
      // Fall back to the visual hit region.
    }
  }
  tapBurst(event.clientX, event.clientY);
  if (hits.includes("Head") || relativeY < 0.58) patPet();
  else pokePet();
}

const PET_MOTION_LINES = {
  aidale: "鱼鳍摇摇，今天也慢慢游。",
  bubble: "咕噜咕噜……泡泡比待办事项可爱多了。",
  selfie: "先别眨眼，本鱼要发给鱼缸群。",
  selfieQuick: "咔嚓。好了，本鱼今天也很上镜。",
  ketchup: "番茄酱是番茄，所以也算补充番茄了。",
  openLid: "里面没有藏小鱼干，别看了。",
  splash: "甩你一脸水花，清醒一点了没？",
  idle: "本鱼在。你忙你的。",
};

function triggerPetMotion(actionId) {
  const action = PET_MOTION_MENU.find((item) => item.id === actionId);
  if (!action) return;
  playLive2DMotion(action.id);
  if (action.expression) playLive2DExpression(action.expression);
  speakAsPet(PET_MOTION_LINES[action.id] || "本鱼动一下给你看。", 3800);
}

function closePetContextMenu() {
  document.querySelector(".pet-context-menu")?.remove();
}

function showPetContextMenu(clientX, clientY) {
  closePetContextMenu();
  const menu = document.createElement("div");
  menu.className = "pet-context-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML = `
    <div class="pet-context-head">
      <strong>想怎么逗本鱼？</strong>
      <span>右键菜单 · 拖拽可换位置 · 滚轮可缩放</span>
    </div>
    <div class="pet-context-grid">
      ${PET_MOTION_MENU.map(
        (item) =>
          `<button type="button" role="menuitem" data-pet-action="${item.id}">${item.label}</button>`,
      ).join("")}
    </div>
    <div class="pet-context-expressions">
      <span>表情</span>
      ${Object.entries(EXPRESSION_LABELS)
        .map(
          ([id, label]) =>
            `<button type="button" role="menuitem" data-pet-expression="${id}">${label}</button>`,
        )
        .join("")}
    </div>`;
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(clientX, window.innerWidth - rect.width - 12)}px`;
  menu.style.top = `${Math.min(clientY, window.innerHeight - rect.height - 12)}px`;
  requestAnimationFrame(() => menu.classList.add("is-open"));
}

function beginPetPointer(event) {
  if (event.button !== 0) return;
  ui.petDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: ui.petOffsetX,
    offsetY: ui.petOffsetY,
  };
  ui.petDragging = false;
  els.petMascot.setPointerCapture?.(event.pointerId);
}

function movePetPointer(event) {
  ui.lastPointerMoveAt = Date.now();
  focusLive2DAt(event.clientX, event.clientY);
  if (!ui.petDrag || ui.petDrag.pointerId !== event.pointerId) return;
  const dx = event.clientX - ui.petDrag.startX;
  const dy = event.clientY - ui.petDrag.startY;
  if (!ui.petDragging && Math.hypot(dx, dy) < 7) return;
  ui.petDragging = true;
  ui.petOffsetX = ui.petDrag.offsetX + dx;
  ui.petOffsetY = ui.petDrag.offsetY + dy;
  els.petMascot.classList.add("is-dragging");
  fitLive2DModel();
}

function endPetPointer(event) {
  if (!ui.petDrag || ui.petDrag.pointerId !== event.pointerId) return;
  if (ui.petDragging) {
    ui.suppressPetTapUntil = performance.now() + 360;
    els.petMascot.dataset.position = `${Math.round(ui.petOffsetX)},${Math.round(
      ui.petOffsetY,
    )}`;
  }
  ui.petDrag = null;
  ui.petDragging = false;
  els.petMascot.classList.remove("is-dragging");
  els.petMascot.releasePointerCapture?.(event.pointerId);
}

function handlePetWheel(event) {
  if (!live2dReady) return;
  event.preventDefault();
  const direction = event.deltaY > 0 ? -1 : 1;
  ui.petScale = Math.min(1.28, Math.max(0.72, ui.petScale + direction * 0.06));
  els.petMascot.dataset.petScale = ui.petScale.toFixed(2);
  fitLive2DModel();
}

function scheduleIdleInteraction() {
  clearTimeout(idleInteractionTimer);
  const delay = 11_000 + Math.random() * 11_000;
  idleInteractionTimer = setTimeout(() => {
    const canInteract =
      ui.view === "today" &&
      document.visibilityState === "visible" &&
      !ui.petDragging &&
      Date.now() - ui.lastPointerMoveAt > 5200;
    if (canInteract && live2dReady) {
      const roll = Math.random();
      if (roll < 0.3) {
        const motions = PET_MOTION_MENU.filter((item) => item.id !== "idle");
        playLive2DMotion(motions[Math.floor(Math.random() * motions.length)].id);
      } else if (roll < 0.5) {
        const props = Array.from(PROP_ITEM_BY_ID.keys());
        const propId = props[Math.floor(Math.random() * props.length)];
        setLive2DTemporaryProp(propId, 5200);
      } else if (roll < 0.69) {
        const names = LIVE2D_FACE_ITEMS.map((item) => item.id);
        playLive2DExpression(names[Math.floor(Math.random() * names.length)], {
          duration: 3000,
        });
      } else if (roll < 0.76) {
        speakAsPet(pickPetLine(PROACTIVE_LINES), 4800);
        playLive2DExpression("question", { duration: 3200 });
      }
    }
    scheduleIdleInteraction();
  }, delay);
}

function scheduleIdleLookAround() {
  clearInterval(idleLookAroundTimer);
  idleLookAroundTimer = setInterval(() => {
    if (
      !live2dReady ||
      ui.view !== "today" ||
      document.visibilityState !== "visible" ||
      ui.petDragging ||
      Date.now() - ui.lastPointerMoveAt < 3200
    ) {
      return;
    }
    if (!live2dApp) return;
    const x = live2dApp.screen.width * (0.22 + Math.random() * 0.56);
    const y = live2dApp.screen.height * (0.16 + Math.random() * 0.36);
    const rect = els.petStage.getBoundingClientRect();
    const clientX = rect.left + (x / live2dApp.screen.width) * rect.width;
    const clientY = rect.top + (y / live2dApp.screen.height) * rect.height;
    focusLive2DAt(clientX, clientY);
    els.petMascot.dataset.idleGaze = Math.random() < 0.5 ? "left" : "right";
  }, 3600);
}

function tapBurst(clientX, clientY) {
  if (!els.petStage) return;
  const rect = els.petStage.getBoundingClientRect();
  const symbols = ["♥", "✦", "·"];
  for (let index = 0; index < 3; index += 1) {
    const heart = document.createElement("span");
    heart.className = "tap-heart";
    heart.textContent = symbols[index % symbols.length];
    heart.style.left = `${clientX - rect.left + (index - 1) * 12}px`;
    heart.style.top = `${clientY - rect.top}px`;
    heart.style.setProperty("--heart-x", `${(index - 1) * 18}px`);
    heart.style.animationDelay = `${index * 40}ms`;
    els.petStage.appendChild(heart);
    setTimeout(() => heart.remove(), 1350);
  }
}

function openCompanion({ focusInput = false } = {}) {
  if (ui.view !== "today") setView("today", { preserveScroll: true });
  ui.chatOpen = true;
  if (focusInput) {
    setTimeout(() => {
      els.chatInput.focus();
      els.chatInput.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
  }
}

function closeCompanion() {
  ui.chatOpen = false;
}

function setView(view, { preserveScroll = false } = {}) {
  ui.view = view;
  renderNavigation();
  if (view === "focus") renderFocus();
  if (view === "schedule") renderSchedule();
  if (view === "today") {
    live2dApp?.start?.();
    requestAnimationFrame(() => {
      live2dApp?.resize?.();
      fitLive2DModel();
    });
  } else {
    live2dApp?.stop?.();
  }
  if (!preserveScroll) {
    els.main.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (window.innerWidth <= 1180) closeCompanion();
}

function startFocusWithTask(taskId = "") {
  if (state.timer.status === "running" || state.timer.status === "paused") {
    setView("focus", { preserveScroll: true });
    return;
  }
  startNewFocus({
    durationMin: ui.focusMinutes,
    taskId: taskId || state.settings.focusTaskId || "",
  });
}

function handleGlobalClick(event) {
  const target = event.target;

  const petAction = target.closest("[data-pet-action]");
  if (petAction) {
    triggerPetMotion(petAction.dataset.petAction);
    closePetContextMenu();
    return;
  }

  const petExpression = target.closest("[data-pet-expression]");
  if (petExpression) {
    const expression = petExpression.dataset.petExpression;
    playLive2DExpression(expression);
    if (EXPRESSION_MOTIONS[expression]) playLive2DMotion(EXPRESSION_MOTIONS[expression]);
    speakAsPet(`*（${EXPRESSION_LABELS[expression] || "做了个表情"}）*`, 2400);
    closePetContextMenu();
    return;
  }

  if (!target.closest(".pet-context-menu, #pet-mascot")) {
    closePetContextMenu();
  }

  if (
    els.emotePanel &&
    !els.emotePanel.hidden &&
    !target.closest("#emote-panel, #open-emote-panel")
  ) {
    toggleEmotePanel(false);
  }

  if (
    els.conversationPanel &&
    !els.conversationPanel.hidden &&
    !target.closest("#conversation-panel, #open-conversation-panel")
  ) {
    toggleConversationPanel(false);
  }

  if (target.closest("[data-modal-close]")) {
    closeModal();
    return;
  }

  const chatAction = target.closest("[data-chat-action]");
  if (chatAction) {
    const { chatAction: action, messageId, proposalId } = chatAction.dataset;
    if (action === "confirm") confirmProposal(messageId, proposalId);
    if (action === "cancel") cancelProposal(messageId, proposalId);
    if (action === "undo") undoProposal(messageId, proposalId);
    return;
  }

  const emoteTab = target.closest("[data-emote-tab]");
  if (emoteTab) {
    setEmoteTab(emoteTab.dataset.emoteTab);
    return;
  }

  const expression = target.closest("[data-live-expression]");
  if (expression) {
    sendLiveExpression(expression.dataset.liveExpression, expression.dataset.expressionLabel);
    return;
  }

  const liveProp = target.closest("[data-live-prop]");
  if (liveProp) {
    setLive2DProp(liveProp.dataset.liveProp);
    return;
  }

  const liveAction = target.closest("[data-live-action]");
  if (liveAction) {
    performLive2DAction(liveAction.dataset.liveAction);
    return;
  }

  const sticker = target.closest("[data-sticker-id]");
  if (sticker) {
    sendSticker(sticker.dataset.stickerId);
    return;
  }

  const skillModeButton = target.closest("[data-skill-mode]");
  if (skillModeButton) {
    setSkillMode(skillModeButton.dataset.skillMode);
    return;
  }

  const conversationItem = target.closest("[data-conversation-id]");
  if (conversationItem) {
    switchConversation(conversationItem.dataset.conversationId);
    return;
  }

  const toggle = target.closest("[data-task-toggle]");
  if (toggle) {
    event.stopPropagation();
    toggleTaskDone(toggle.dataset.taskToggle);
    return;
  }

  const taskOpen = target.closest("[data-task-open]");
  if (taskOpen) {
    openTaskModal({ taskId: taskOpen.dataset.taskOpen });
    return;
  }

  const addTask = target.closest("[data-add-task]");
  if (addTask) {
    const dateKey = ui.view === "schedule" ? toDateKey(ui.scheduleAnchor) : toDateKey();
    openTaskModal({ dateKey });
    return;
  }

  const promptTarget = target.closest("[data-prompt]");
  if (promptTarget) {
    openCompanion();
    sendChatMessage(promptTarget.dataset.prompt);
    return;
  }

  const planStart = target.closest("[data-start-plan]");
  if (planStart) {
    startPlan(planStart.dataset.startPlan);
    return;
  }

  const scheduleView = target.closest("[data-schedule-view]");
  if (scheduleView) {
    ui.scheduleMode = scheduleView.dataset.scheduleView;
    renderSchedule();
    return;
  }

  const addDate = target.closest("[data-add-date]");
  if (addDate) {
    openTaskModal({ dateKey: addDate.dataset.addDate });
    return;
  }

  const openDay = target.closest("[data-open-day]");
  if (openDay) {
    ui.scheduleMode = "day";
    ui.scheduleAnchor = fromDateKey(openDay.dataset.openDay);
    renderSchedule();
    return;
  }

  const goView = target.closest("[data-go-view]");
  if (goView) {
    event.preventDefault();
    setView(goView.dataset.goView);
  }
}

function bindEvents() {
  document.addEventListener("click", handleGlobalClick);

  els.focusPresets.addEventListener("click", (event) => {
    const button = event.target.closest("[data-focus-minutes]");
    if (button) selectFocusMinutes(button.dataset.focusMinutes);
  });

  els.focusTaskSelect.addEventListener("change", () => {
    state.settings.focusTaskId = els.focusTaskSelect.value;
    if (state.timer.status === "idle") state.timer.taskId = els.focusTaskSelect.value;
    save();
  });

  els.focusPrimary.addEventListener("click", toggleTimer);
  els.focusSecondary.addEventListener("click", abandonTimer);

  els.nextTaskFocus.addEventListener("click", () => {
    startFocusWithTask(ui.nextTaskId);
  });
  els.hideNextTask.addEventListener("click", () => {
    state.settings.nextTaskCardHidden = true;
    save();
    applyNextTaskVisibility();
  });
  els.showNextTask.addEventListener("click", () => {
    state.settings.nextTaskCardHidden = false;
    save();
    applyNextTaskVisibility();
  });

  [els.topbarStartFocus, els.sidebarStartFocus].forEach((button) => {
    button.addEventListener("click", () => {
      if (state.timer.status === "running" || state.timer.status === "paused") {
        setView("focus", { preserveScroll: true });
      } else {
        startFocusWithTask(ui.nextTaskId);
        const petName = state.settings.petName || "大肥鱼";
        setTimeout(
          () => sendChatMessage(`我开始努力干活啦，${petName}`, { forceChatOnly: true }),
          180,
        );
      }
    });
  });

  els.addTaskButton.addEventListener("click", () => {
    openTaskModal({ dateKey: toDateKey(ui.scheduleAnchor) });
  });

  els.schedulePrev.addEventListener("click", () => {
    ui.scheduleAnchor = addDays(ui.scheduleAnchor, ui.scheduleMode === "week" ? -7 : -1);
    renderSchedule();
  });

  els.scheduleNext.addEventListener("click", () => {
    ui.scheduleAnchor = addDays(ui.scheduleAnchor, ui.scheduleMode === "week" ? 7 : 1);
    renderSchedule();
  });

  els.scheduleToday.addEventListener("click", () => {
    ui.scheduleAnchor = fromDateKey(toDateKey());
    renderSchedule();
  });

  els.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendChatMessage(els.chatInput.value, { clearInput: true });
  });

  els.chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      els.chatForm.requestSubmit();
    }
  });

  els.chatInput.addEventListener("input", resizeChatInput);
  els.chatInput.addEventListener("input", () => {
    ui.lastActivityAt = Date.now();
    scheduleProactiveChat();
  });
  els.chatSkillToggle.addEventListener("click", () => {
    if (ui.skillMode) {
      setSkillMode(null);
      return;
    }
    const willOpen = els.chatSkillSuggestions.hidden;
    els.chatSuggestions.hidden = willOpen;
    els.chatSkillSuggestions.hidden = !willOpen;
    els.chatSkillToggle.classList.toggle("is-active", willOpen);
  });
  els.chatSkillClose.addEventListener("click", () => {
    els.chatSkillSuggestions.hidden = true;
    els.chatSuggestions.hidden = false;
    els.chatSkillToggle.classList.remove("is-active");
  });
  els.skillModeClose.addEventListener("click", () => setSkillMode(null));
  els.editPetName.addEventListener("click", openNameModal);
  els.openPersonaEditor.addEventListener("click", openPersonaPromptModal);
  els.openSettingsModal.addEventListener("click", openPersonaPromptModal);
  els.openConversationPanel.addEventListener("click", () => toggleConversationPanel());
  els.newConversationButton.addEventListener("click", () => createConversation());
  els.clearConversationButton.addEventListener("click", clearCurrentConversation);
  els.clearOtherConversationsButton.addEventListener("click", clearOtherConversations);
  els.editPersonaPrompt.addEventListener("click", openPersonaPromptModal);
  els.openEmotePanel.addEventListener("click", () => toggleEmotePanel());
  els.resetLive2DState.addEventListener("click", resetLive2DPetState);
  els.openApiSettings.addEventListener("click", openApiSettingsModal);

  els.companionToggle.addEventListener("click", () => openCompanion({ focusInput: true }));
  els.companionClose.addEventListener("click", closeCompanion);
  els.companionScrim.addEventListener("click", closeCompanion);
  els.mobileChatButton.addEventListener("click", () => openCompanion({ focusInput: true }));

  els.petSpeechClose.addEventListener("click", () => {
    clearTimeout(petSpeechTimer);
    els.petSpeech.classList.add("is-hidden");
  });
  els.petMascot.addEventListener("pointerenter", () => {
    els.petStage.classList.add("is-hovering");
  });

  els.petMascot.addEventListener("pointerleave", () => {
    els.petStage.classList.remove("is-hovering");
    if (!ui.petDragging) focusLive2DAtCenter();
  });

  els.petMascot.addEventListener("pointerdown", beginPetPointer);
  els.petMascot.addEventListener("pointermove", movePetPointer);
  els.petMascot.addEventListener("pointerup", endPetPointer);
  els.petMascot.addEventListener("pointercancel", endPetPointer);
  els.petMascot.addEventListener("wheel", handlePetWheel, { passive: false });
  els.petMascot.addEventListener("click", handlePetTap);

  els.petMascot.addEventListener("dblclick", (event) => {
    event.preventDefault();
    playLive2DMotion("selfie");
    playLive2DExpression("stars");
    speakAsPet("又摸又拍，本鱼今天营业过头了。", 4200);
  });

  els.petMascot.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showPetContextMenu(event.clientX, event.clientY);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (document.querySelector(".pet-context-menu")) {
      closePetContextMenu();
      return;
    }
    if (els.modalRoot.classList.contains("is-open")) {
      const cancel = els.modalRoot.querySelector("[data-confirm-cancel], [data-modal-close]");
      if (cancel) cancel.click();
      else closeModal();
      return;
    }
    if (!els.emotePanel.hidden) {
      toggleEmotePanel(false);
      return;
    }
    if (!els.conversationPanel.hidden) {
      toggleConversationPanel(false);
      return;
    }
    const success = document.querySelector(".success-overlay");
    if (success) success.remove();
    if (ui.chatOpen) closeCompanion();
  });

  document.addEventListener("visibilitychange", () => {
    closePetContextMenu();
    if (document.visibilityState === "visible") {
      tickTimer();
      renderTopbar();
      if (ui.view === "schedule") renderSchedule();
      if (ui.view === "today") live2dApp?.start?.();
      scheduleProactiveChat();
    } else {
      live2dApp?.stop?.();
    }
  });

  window.addEventListener("beforeunload", save);
  window.addEventListener("resize", () => {
    applyChatWidth();
    closePetContextMenu();
  });
}

function init() {
  els.focusRing.style.strokeDasharray = String(RING_CIRCUMFERENCE);
  els.focusRing.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
  if (state.timer.status === "running" && state.timer.endsAt) {
    state.timer.remainingSec = timerRemaining();
  }
  renderAll();
  bindEvents();
  initChatResize();
  if (Array.isArray(state.settings.live2dProps)) {
    for (const propId of state.settings.live2dProps) {
      if (PROP_ITEM_BY_ID.has(propId)) live2dRig.persistentProps.add(propId);
    }
  }
  initLive2D();
  scheduleProactiveChat();
  scheduleIdleInteraction();
  scheduleIdleLookAround();
  tickTimer();
  setInterval(tickTimer, 500);
  checkRemoteMode();
  setTimeout(() => {
    if (!ui.chatOpen && els.petSpeechText.textContent) {
      els.petSpeech.classList.remove("is-hidden");
    }
  }, 550);
}

window.__dafiyuDemo = {
  state,
  ui,
  save,
  renderAll,
  completeTimer,
  startNewFocus,
  renderSchedule,
};

init();
