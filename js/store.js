export const STORAGE_KEY = "dafiyu-study-room-demo-v1";

export const WEEKDAY_SHORT = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
export const WEEKDAY_LONG = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

export const TASK_TONES = {
  sea: {
    label: "海盐",
    color: "#5fa9a3",
    wash: "rgba(206, 235, 228, 0.9)",
  },
  coral: {
    label: "珊瑚",
    color: "#f47f6c",
    wash: "rgba(255, 225, 217, 0.94)",
  },
  gold: {
    label: "日光",
    color: "#e7b34d",
    wash: "rgba(255, 241, 203, 0.94)",
  },
  sage: {
    label: "海藻",
    color: "#91b688",
    wash: "rgba(228, 240, 220, 0.94)",
  },
};

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function addDays(dateOrKey, amount) {
  const date = typeof dateOrKey === "string" ? fromDateKey(dateOrKey) : new Date(dateOrKey);
  date.setDate(date.getDate() + amount);
  return date;
}

export function startOfWeekMonday(dateOrKey = new Date()) {
  const date = typeof dateOrKey === "string" ? fromDateKey(dateOrKey) : new Date(dateOrKey);
  date.setHours(0, 0, 0, 0);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date;
}

export function isSameDay(left, right) {
  return toDateKey(left) === toDateKey(right);
}

export function timeToMinutes(time) {
  const [hours = 0, minutes = 0] = String(time || "00:00")
    .split(":")
    .map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes) {
  const safe = Math.max(0, Math.min(24 * 60 - 1, Math.round(totalMinutes)));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function addMinutes(time, minutes) {
  return minutesToTime(timeToMinutes(time) + Number(minutes));
}

export function formatDate(dateOrKey, style = "long") {
  const date = typeof dateOrKey === "string" ? fromDateKey(dateOrKey) : dateOrKey;
  if (style === "short") {
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  }
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${WEEKDAY_LONG[date.getDay()]}`;
}

export function formatDuration(minutes) {
  const value = Number(minutes) || 0;
  if (value < 60) return `${value} 分钟`;
  if (value % 60 === 0) return `${value / 60} 小时`;
  return `${Math.floor(value / 60)} 小时 ${value % 60} 分钟`;
}

export function formatClock(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function compactDateLabel(dateKey) {
  const date = fromDateKey(dateKey);
  const today = toDateKey();
  const tomorrow = toDateKey(addDays(new Date(), 1));
  if (dateKey === today) return "今天";
  if (dateKey === tomorrow) return "明天";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function chooseTone(seed = "") {
  const keys = Object.keys(TASK_TONES);
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return keys[hash % keys.length];
}

export function createSeedState() {
  const now = new Date();
  const today = toDateKey(now);
  const tomorrow = toDateKey(addDays(now, 1));
  const dayAfter = toDateKey(addDays(now, 2));
  const yesterday = toDateKey(addDays(now, -1));

  const tasks = [
    {
      id: "seed-task-1",
      title: "整理论文第二章提纲",
      dateKey: today,
      start: "09:20",
      duration: 35,
      priority: "high",
      tone: "coral",
      notes: "先列三级标题，不追求句子漂亮。",
      done: true,
      createdAt: addDays(now, -2).toISOString(),
    },
    {
      id: "seed-task-2",
      title: "读《深度工作》20 页",
      dateKey: today,
      start: "13:40",
      duration: 40,
      priority: "medium",
      tone: "sea",
      notes: "读到有用的地方，只记一句话。",
      done: false,
      createdAt: addDays(now, -1).toISOString(),
    },
    {
      id: "seed-task-3",
      title: "复盘今天学到的 3 件事",
      dateKey: today,
      start: "19:30",
      duration: 20,
      priority: "medium",
      tone: "gold",
      notes: "",
      done: false,
      createdAt: now.toISOString(),
    },
    {
      id: "seed-task-4",
      title: "把文献综述拆成三段",
      dateKey: tomorrow,
      start: "10:00",
      duration: 45,
      priority: "high",
      tone: "sage",
      notes: "每段只写一个核心判断。",
      done: false,
      createdAt: now.toISOString(),
    },
    {
      id: "seed-task-5",
      title: "整理英语阅读笔记",
      dateKey: tomorrow,
      start: "15:30",
      duration: 30,
      priority: "medium",
      tone: "sea",
      notes: "",
      done: false,
      createdAt: now.toISOString(),
    },
    {
      id: "seed-task-6",
      title: "给论文写一个不完美的小开头",
      dateKey: dayAfter,
      start: "09:30",
      duration: 40,
      priority: "medium",
      tone: "coral",
      notes: "先写 300 字，允许之后重来。",
      done: false,
      createdAt: now.toISOString(),
    },
  ];

  const sessions = [
    {
      id: "seed-session-1",
      dateKey: today,
      minutes: 25,
      completed: true,
      taskTitle: "整理论文第二章提纲",
      endedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 55).toISOString(),
    },
    {
      id: "seed-session-2",
      dateKey: today,
      minutes: 28,
      completed: true,
      taskTitle: "清晨自由专注",
      endedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 5).toISOString(),
    },
    {
      id: "seed-session-3",
      dateKey: yesterday,
      minutes: 35,
      completed: true,
      taskTitle: "文献阅读",
      endedAt: addDays(now, -1).toISOString(),
    },
    {
      id: "seed-session-4",
      dateKey: toDateKey(addDays(now, -2)),
      minutes: 25,
      completed: true,
      taskTitle: "英语精读",
      endedAt: addDays(now, -2).toISOString(),
    },
    {
      id: "seed-session-5",
      dateKey: toDateKey(addDays(now, -3)),
      minutes: 50,
      completed: true,
      taskTitle: "论文提纲",
      endedAt: addDays(now, -3).toISOString(),
    },
    {
      id: "seed-session-6",
      dateKey: toDateKey(addDays(now, -5)),
      minutes: 20,
      completed: true,
      taskTitle: "整理资料",
      endedAt: addDays(now, -5).toISOString(),
    },
    {
      id: "seed-session-7",
      dateKey: toDateKey(addDays(now, -6)),
      minutes: 25,
      completed: true,
      taskTitle: "阅读",
      endedAt: addDays(now, -6).toISOString(),
    },
  ];

  const seedConversations = [
    {
      id: "seed-conversation-1",
      title: "日常聊天",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      messages: [
        {
          id: "seed-message-1",
          role: "assistant",
          text: "*（其实本鱼刚刚也在摸鱼……）* 主人，本鱼在这儿。想聊天就聊天，想安排事情再叫本鱼。",
          at: now.toISOString(),
          proposals: [],
        },
      ],
    },
  ];

  return {
    version: 1,
    tasks,
    sessions,
    checkins: [
      toDateKey(addDays(now, -2)),
      yesterday,
      today,
    ],
    plans: [
      {
        id: "seed-plan-1",
        title: "把论文往前推一点",
        status: "active",
        currentItemId: "seed-plan-item-1",
        focusMinutes: 25,
        createdAt: now.toISOString(),
        items: [
          {
            id: "seed-plan-item-1",
            label: "整理第二章提纲",
            taskId: "seed-task-1",
            targetRounds: 2,
            completedRounds: 1,
          },
          {
            id: "seed-plan-item-2",
            label: "写 500 字初稿",
            taskId: null,
            targetRounds: 1,
            completedRounds: 0,
          },
        ],
      },
    ],
    conversations: seedConversations,
    activeConversationId: seedConversations[0].id,
    timer: {
      id: null,
      status: "idle",
      mode: "focus",
      durationSec: 25 * 60,
      remainingSec: 25 * 60,
      endsAt: null,
      startedAt: null,
      taskId: "",
      planId: null,
      planItemId: null,
    },
    settings: {
      focusMinutes: 25,
      focusTaskId: "",
      lastPetLineAt: 0,
      userName: "主人",
      petName: "大肥鱼",
      customPersonaPrompt: "",
      personaPreset: "original",
      chatWidth: 380,
      proactiveEnabled: true,
      proactiveChance: 0.35,
      proactiveIntervalMin: 5,
      proactiveLastAt: 0,
    },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    const parsed = JSON.parse(raw);
    const seed = createSeedState();
    const parsedConversations =
      Array.isArray(parsed.conversations) && parsed.conversations.length
        ? parsed.conversations
        : null;
    const legacyMessages = Array.isArray(parsed.chat) ? parsed.chat : null;
    const conversations =
      parsedConversations ||
      [
        {
          id: "migrated-conversation-1",
          title: "延续的对话",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: legacyMessages || seed.conversations[0].messages,
        },
      ];
    const activeConversationId = conversations.some(
      (conversation) => conversation.id === parsed.activeConversationId,
    )
      ? parsed.activeConversationId
      : conversations[0].id;
    return {
      ...seed,
      ...parsed,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : seed.tasks,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : seed.sessions,
      checkins: Array.isArray(parsed.checkins) ? parsed.checkins : seed.checkins,
      plans: Array.isArray(parsed.plans) ? parsed.plans : seed.plans,
      conversations,
      activeConversationId,
      timer: { ...seed.timer, ...(parsed.timer || {}) },
      settings: { ...seed.settings, ...(parsed.settings || {}) },
    };
  } catch (error) {
    console.warn("Unable to load demo state, starting fresh.", error);
    return createSeedState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Unable to persist demo state.", error);
  }
}
