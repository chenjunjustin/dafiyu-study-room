import {
  addDays,
  chooseTone,
  compactDateLabel,
  formatDate,
  formatDuration,
  minutesToTime,
  timeToMinutes,
  toDateKey,
} from "./store.js";

const CN_NUMBERS = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const DATE_WORDS = {
  大后天: 3,
  后天: 2,
  今天: 0,
  今日: 0,
  明天: 1,
  明日: 1,
};

const WEEKDAY_INDEX = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0,
};

function chineseNumber(input) {
  const text = String(input || "").trim();
  if (!text) return Number.NaN;
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  if (text === "半") return 0.5;
  if (!/[零〇一二两三四五六七八九十]/.test(text)) return Number.NaN;

  if (text.includes("十")) {
    const [tensPart, onesPart] = text.split("十");
    const tens = tensPart ? CN_NUMBERS[tensPart] ?? 0 : 1;
    const ones = onesPart ? CN_NUMBERS[onesPart] ?? 0 : 0;
    return tens * 10 + ones;
  }

  let result = 0;
  for (const character of text) {
    if (CN_NUMBERS[character] === undefined) return Number.NaN;
    result = result * 10 + CN_NUMBERS[character];
  }
  return result;
}

function matchDate(text) {
  for (const [word, offset] of Object.entries(DATE_WORDS)) {
    if (text.includes(word)) {
      const index = text.indexOf(word);
      return {
        dateKey: toDateKey(addDays(new Date(), offset)),
        start: index,
        end: index + word.length,
        raw: word,
      };
    }
  }

  const weekMatch = text.match(/(下周|这周|周|星期|礼拜)([一二三四五六日天])/);
  if (weekMatch) {
    const target = WEEKDAY_INDEX[weekMatch[2]];
    const now = new Date();
    let delta = (target - now.getDay() + 7) % 7;
    if (weekMatch[1] === "下周") delta += 7;
    return {
      dateKey: toDateKey(addDays(now, delta)),
      start: weekMatch.index,
      end: weekMatch.index + weekMatch[0].length,
      raw: weekMatch[0],
    };
  }

  const monthDayMatch = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/);
  if (monthDayMatch) {
    const now = new Date();
    let year = now.getFullYear();
    let candidate = new Date(year, Number(monthDayMatch[1]) - 1, Number(monthDayMatch[2]));
    if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      year += 1;
      candidate = new Date(year, Number(monthDayMatch[1]) - 1, Number(monthDayMatch[2]));
    }
    return {
      dateKey: toDateKey(candidate),
      start: monthDayMatch.index,
      end: monthDayMatch.index + monthDayMatch[0].length,
      raw: monthDayMatch[0],
    };
  }

  const slashDateMatch = text.match(/(?<!\d)(\d{1,2})\/(\d{1,2})(?!\d)/);
  if (slashDateMatch) {
    const now = new Date();
    let year = now.getFullYear();
    let candidate = new Date(year, Number(slashDateMatch[1]) - 1, Number(slashDateMatch[2]));
    if (candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      year += 1;
      candidate = new Date(year, Number(slashDateMatch[1]) - 1, Number(slashDateMatch[2]));
    }
    return {
      dateKey: toDateKey(candidate),
      start: slashDateMatch.index,
      end: slashDateMatch.index + slashDateMatch[0].length,
      raw: slashDateMatch[0],
    };
  }

  return null;
}

function normalizeHour(hour, period) {
  let normalized = hour;
  if (period === "下午" || period === "傍晚" || period === "晚上" || period === "夜里") {
    if (normalized < 12) normalized += 12;
  } else if (period === "中午") {
    if (normalized < 11) normalized += 12;
    if (normalized === 12) normalized = 12;
  } else if (period === "上午" || period === "早上") {
    if (normalized === 12) normalized = 0;
  } else if (normalized >= 1 && normalized <= 7) {
    normalized += 12;
  }
  if (normalized === 24) normalized = 0;
  return normalized;
}

function matchTime(text) {
  const colonMatch = text.match(/(上午|早上|中午|下午|傍晚|晚上|夜里)?\s*(\d{1,2})[:：](\d{2})/);
  if (colonMatch) {
    const hour = normalizeHour(Number(colonMatch[2]), colonMatch[1]);
    const minute = Number(colonMatch[3]);
    return {
      time: minutesToTime(hour * 60 + minute),
      start: colonMatch.index,
      end: colonMatch.index + colonMatch[0].length,
      raw: colonMatch[0],
    };
  }

  const pointMatch = text.match(
    /(上午|早上|中午|下午|傍晚|晚上|夜里)?\s*(\d{1,2}|[零〇一二两三四五六七八九十]{1,3})\s*[点時时](?:\s*(半|[零〇一二两三四五六七八九十]{1,3})\s*分?)?/,
  );
  if (!pointMatch) return null;

  let hour = chineseNumber(pointMatch[2]);
  if (!Number.isFinite(hour)) return null;
  let minute = 0;
  if (pointMatch[3] === "半") minute = 30;
  else if (pointMatch[3]) minute = chineseNumber(pointMatch[3]) || 0;
  hour = normalizeHour(hour, pointMatch[1]);

  return {
    time: minutesToTime(hour * 60 + minute),
    start: pointMatch.index,
    end: pointMatch.index + pointMatch[0].length,
    raw: pointMatch[0],
  };
}

function matchDuration(text) {
  const halfHour = text.match(/半\s*(?:个)?\s*小时/);
  if (halfHour) {
    return {
      minutes: 30,
      start: halfHour.index,
      end: halfHour.index + halfHour[0].length,
      raw: halfHour[0],
    };
  }

  const hourMatch = text.match(/(\d+(?:\.\d+)?|[零〇一二两三四五六七八九十]+)\s*(?:个)?\s*(小时|钟头)/);
  if (hourMatch) {
    const value = chineseNumber(hourMatch[1]);
    if (Number.isFinite(value)) {
      return {
        minutes: Math.round(value * 60),
        start: hourMatch.index,
        end: hourMatch.index + hourMatch[0].length,
        raw: hourMatch[0],
      };
    }
  }

  const minuteMatch = text.match(/(\d+|[零〇一二两三四五六七八九十]+)\s*(分钟|分)/);
  if (minuteMatch) {
    const value = chineseNumber(minuteMatch[1]);
    if (Number.isFinite(value)) {
      return {
        minutes: Math.round(value),
        start: minuteMatch.index,
        end: minuteMatch.index + minuteMatch[0].length,
        raw: minuteMatch[0],
      };
    }
  }

  return null;
}

function maskMatches(text, matches) {
  const characters = Array.from(text);
  for (const match of matches.filter(Boolean)) {
    for (let index = match.start; index < match.end; index += 1) {
      if (characters[index] !== undefined) characters[index] = " ";
    }
  }
  return characters.join("");
}

function cleanTitle(rawTitle) {
  return rawTitle
    .replace(/[，,。！？!?；;：:、“”"'（）()]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(?:帮我|请|麻烦|给我|我想|我要|想|在|把|于|安排(?:一个|一下|个)?|加(?:一个|个)?|新增|记(?:一下|一个)?|提醒我|设定?)\s*/g, "")
    .replace(/\s*(?:吧|好吗|可以吗|呗|谢谢|呀|哈|一下)$/g, "")
    .trim();
}

function defaultStartFor(dateKey) {
  const now = new Date();
  const today = toDateKey(now);
  if (dateKey !== today) return "09:30";

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (currentMinutes > 21 * 60 + 20) {
    return null;
  }
  const rounded = Math.ceil((currentMinutes + 10) / 30) * 30;
  return minutesToTime(Math.max(8 * 60, rounded));
}

function taskDateTime(task) {
  const date = new Date(`${task.dateKey}T${task.start}:00`);
  return date.getTime();
}

function findTaskByText(text, state, dateKey = null) {
  const candidates = state.tasks
    .filter((task) => !dateKey || task.dateKey === dateKey)
    .sort((left, right) => taskDateTime(left) - taskDateTime(right));
  const query = cleanTitle(text)
    .replace(/^(?:删除|删掉|去掉|取消|捞掉|开始|专注|这个|一下|今天|明天)\s*/g, "")
    .trim();
  if (query && query.length >= 2) {
    const exact = candidates.find(
      (task) => task.title.includes(query) || query.includes(task.title),
    );
    if (exact) return exact;
  }
  return null;
}

function hasOverlap(candidate, state) {
  const start = timeToMinutes(candidate.start);
  const end = start + Number(candidate.duration || 25);
  return state.tasks.filter((task) => {
    if (task.dateKey !== candidate.dateKey) return false;
    const taskStart = timeToMinutes(task.start);
    const taskEnd = taskStart + Number(task.duration || 0);
    return start < taskEnd && end > taskStart;
  });
}

function planItemsFromText(text) {
  let body = text;
  const colonIndex = Math.max(body.lastIndexOf("："), body.lastIndexOf(":"));
  if (colonIndex >= 0) body = body.slice(colonIndex + 1);
  else body = body.replace(/.*?(?:专注计划|番茄计划|学习计划|计划组|专注航线)/, "");

  return body
    .split(/[，,、;；\n]+/)
    .map((segment) => {
      const roundsMatch = segment.match(/(\d+|[一二两三四五六七八九十]+)\s*轮/);
      const rounds = roundsMatch ? chineseNumber(roundsMatch[1]) : 1;
      const label = segment
        .replace(/(\d+|[一二两三四五六七八九十]+)\s*轮/g, "")
        .replace(/^(?:帮我|给我|安排|做|做一个|做一组|来个|来一组|然后|再|本鱼|计划)\s*/g, "")
        .replace(/[。.!！?？]/g, "")
        .trim();
      return {
        label,
        rounds: Math.max(1, Math.min(8, Number(rounds) || 1)),
      };
    })
    .filter((item) => item.label.length >= 1)
    .slice(0, 8);
}

function todayOpenTasks(state) {
  const today = toDateKey();
  return state.tasks
    .filter((task) => task.dateKey === today && !task.done)
    .sort((left, right) => taskDateTime(left) - taskDateTime(right));
}

function activePlan(state) {
  return state.plans.find((plan) => plan.status === "active") || null;
}

function weeklySummary(state) {
  const now = new Date();
  const start = toDateKey(addDays(now, -6));
  const sessions = state.sessions.filter(
    (session) => session.dateKey >= start && session.dateKey <= toDateKey(now),
  );
  const minutes = sessions.reduce((sum, session) => sum + Number(session.minutes || 0), 0);
  const tomatoes = sessions.filter((session) => session.completed !== false).length;
  return { minutes, tomatoes };
}

function makeCreateTaskAction(text, state) {
  const now = new Date();
  const today = toDateKey(now);
  const dateMatch = matchDate(text);
  const timeMatch = matchTime(text);
  const durationMatch = matchDuration(text);
  let dateKey = dateMatch?.dateKey || today;
  let start = timeMatch?.time || defaultStartFor(dateKey);
  let shifted = false;

  if (!dateMatch && timeMatch) {
    const candidate = new Date(`${today}T${timeMatch.time}:00`);
    if (candidate.getTime() <= now.getTime() + 30_000) {
      dateKey = toDateKey(addDays(now, 1));
      shifted = true;
    }
  }

  if (dateMatch && timeMatch && dateKey === today) {
    const candidate = new Date(`${today}T${timeMatch.time}:00`);
    if (candidate.getTime() <= now.getTime() + 30_000) {
      dateKey = toDateKey(addDays(now, 1));
      shifted = true;
    }
  }

  if (!start) {
    dateKey = toDateKey(addDays(now, 1));
    start = "09:30";
  }

  const title = cleanTitle(maskMatches(text, [dateMatch, timeMatch, durationMatch]));
  if (!title || title.length < 2) return null;

  const duration = Math.max(5, Math.min(240, Number(durationMatch?.minutes) || 25));
  const action = {
    type: "create_task",
    payload: {
      title,
      dateKey,
      start,
      duration,
      priority: /重要|优先|截止|考试|ddl|DDL/.test(text) ? "high" : /顺便|有空|不急/.test(text) ? "low" : "medium",
      tone: chooseTone(title),
      notes: "",
    },
  };
  const conflicts = hasOverlap(action.payload, state);
  const dateLabel = compactDateLabel(dateKey);
  let reply = shifted
    ? `这个点今天已经游过去了，本鱼先把它放到${dateLabel} ${start}。确认了才算数。`
    : `行，本鱼先替你占住${dateLabel} ${start}，${formatDuration(duration)}。确认了才算数。`;
  if (conflicts.length) {
    reply += ` 不过它和「${conflicts[0].title}」有点撞，你自己掂量一下。`;
  }
  return { action, reply };
}

function makeDeleteAction(text, state) {
  const dateMatch = matchDate(text);
  const timeMatch = matchTime(text);
  const durationMatch = matchDuration(text);
  const wantsPlan = /计划|航线|计划组/.test(text);

  if (wantsPlan) {
    const plans = state.plans.filter((plan) => plan.status !== "completed");
    const query = cleanTitle(maskMatches(text, [dateMatch, timeMatch, durationMatch]))
      .replace(/(?:删除|删掉|去掉|取消|捞掉|专注计划|番茄计划|学习计划|计划组|专注航线|计划|的)/g, "")
      .trim();
    const plan =
      plans.find((item) => item.title.includes(query) || query.includes(item.title)) ||
      plans[0] ||
      null;
    if (!plan) {
      return {
        action: null,
        reply: "本鱼没找到还能取消的专注计划。要不要先建一条？",
      };
    }
    return {
      action: {
        type: "delete_plan",
        payload: { planId: plan.id, title: plan.title },
      },
      reply: `要取消「${plan.title}」这条航线？已经完成的番茄会留下，计划本身会消失。`,
    };
  }

  const dateKey = dateMatch?.dateKey || null;
  const task = findTaskByText(maskMatches(text, [dateMatch, timeMatch, durationMatch]), state, dateKey);
  if (!task) {
    return {
      action: null,
      reply: "没对上具体是哪件事。再说得像日程一点，比如「删除写论文」。",
    };
  }
  return {
    action: {
      type: "delete_task",
      payload: { taskId: task.id, title: task.title },
    },
    reply: `找到「${task.title}」了。删除前本鱼再问你一次，别手滑把鱼缸打翻。`,
  };
}

function makeUpdateTaskAction(text, state) {
  const markerMatch = text.match(/(改到|改成|调到|调整为|调整到|推迟到|提前到)/);
  if (!markerMatch) {
    return { action: null, reply: "想改哪件事？告诉本鱼原来的名字和新时间。" };
  }
  const markerIndex = markerMatch.index;
  const left = text.slice(0, markerIndex);
  const right = text.slice(markerIndex);
  const query = cleanTitle(left)
    .replace(/^(?:把|将|请|帮我|麻烦|本鱼)\s*/g, "")
    .replace(/[，,。\s]+$/g, "")
    .trim();
  const tasks = [...state.tasks].sort(
    (a, b) => taskDateTime(a) - taskDateTime(b),
  );
  const task =
    tasks.find(
      (item) =>
        query.length >= 1 &&
        (item.title.includes(query) || query.includes(item.title)),
    ) ||
    (query.length >= 2
      ? tasks.find((item) => query.split("").filter((char) => item.title.includes(char)).length >= Math.min(3, query.length))
      : null);
  if (!task) {
    return {
      action: null,
      reply: query
        ? `没找到叫「${query}」的日程，本鱼不敢乱改。`
        : "想改哪件事？告诉本鱼原来的名字和新时间。",
    };
  }
  const dateMatch = matchDate(right);
  const timeMatch = matchTime(right);
  const durationMatch = matchDuration(right);
  const patch = {};
  if (dateMatch) patch.dateKey = dateMatch.dateKey;
  if (timeMatch) patch.start = timeMatch.time;
  if (durationMatch) patch.duration = Math.max(5, Math.min(240, durationMatch.minutes));
  if (!Object.keys(patch).length) {
    return {
      action: null,
      reply: "要改成哪一天、几点或多久？给本鱼一个具体的新时间。",
    };
  }
  return {
    action: {
      type: "update_task",
      payload: { taskId: task.id, patch },
    },
    reply: `找到「${task.title}」了。新的安排本鱼先放确认卡里，你点头再改。`,
  };
}

function makePlanAction(text, state) {
  let items = planItemsFromText(text);
  const isBreakdown = /拆|步骤|理一下|下一步/.test(text);

  if (!items.length && isBreakdown) {
    const openTasks = todayOpenTasks(state);
    if (openTasks.length) {
      items = openTasks.slice(0, 3).map((task) => ({
        label: task.title,
        rounds: 1,
      }));
    } else {
      items = [
        { label: "先坐下来的 10 分钟", rounds: 1 },
        { label: "推进最小的一步", rounds: 1 },
        { label: "写一句今天学到的", rounds: 1 },
      ];
    }
  }

  if (!items.length) {
    const openTasks = todayOpenTasks(state);
    if (openTasks.length) {
      items = openTasks.slice(0, 3).map((task) => ({ label: task.title, rounds: 1 }));
    }
  }

  if (!items.length) {
    return {
      action: null,
      reply: "想拆哪件事？给本鱼一个名字，比如「把写论文拆成一个专注计划」。",
    };
  }

  const title = isBreakdown ? "把今天拆小一点" : "本鱼排的专注航线";
  return {
    action: {
      type: "create_plan",
      payload: { title, items },
    },
    reply: isBreakdown
      ? "别盯着整片海了，本鱼把它切成几小口。确认后就能一轮一轮游。"
      : "这条路线不赖。确认后本鱼替你摆进专注页，别半路把鱼鳍收了。",
  };
}

function makeStartFocusAction(text, state) {
  const durationMatch = matchDuration(text);
  const duration = Math.max(5, Math.min(180, Number(durationMatch?.minutes) || state.settings.focusMinutes || 25));
  const dateMatch = matchDate(text);
  const timeMatch = matchTime(text);
  const cleaned = maskMatches(text, [durationMatch, dateMatch, timeMatch])
    .replace(/.*?(?:开始|专注|番茄)/g, " ")
    .replace(/^(?:一个|一下|我要|我想|帮我)\s*/g, "")
    .trim();
  const task =
    findTaskByText(cleaned, state, toDateKey()) ||
    todayOpenTasks(state)[0] ||
    null;
  return {
    action: {
      type: "start_focus",
      payload: {
        durationMin: duration,
        taskId: task?.id || "",
        taskTitle: task?.title || "自由专注",
      },
    },
    reply: task
      ? `先做「${task.title}」。就 ${duration} 分钟，本鱼盯着时钟，不盯你。`
      : `行，${duration} 分钟，不绑任务也行。先坐下来就算赢一半。`,
  };
}

function comfortReply(state) {
  return "累就先不跟整片海较劲。本鱼陪你歇一会儿，想吐槽就吐槽，不想说话也行。";
}

export function localAssistantReply(text, state, { enableSkill = false } = {}) {
  const message = String(text || "").trim();
  if (!message) {
    return { reply: "本鱼在听。说一件具体的小事就行。", actions: [] };
  }

  if (/在忙啥|在干嘛|干啥呢|忙什么呢|摸鱼/.test(message)) {
    return {
      reply: "*（其实本鱼刚刚也在摸鱼……）* 忙着训练 AGI 呢，你别耽误本鱼。",
      actions: [],
    };
  }

  if (/陪我聊|聊会儿|聊聊天|别安排任务|随便聊/.test(message)) {
    return {
      reply: "*（好耶，本鱼把日程本合上。）* 行，今天就闲聊。你想吐槽谁，还是想听本鱼编个离谱故事？",
      actions: [],
    };
  }

  if (/说点好玩|讲个故事|逗我笑|无聊/.test(message)) {
    return {
      reply: "*（本鱼的故事库只有小鱼干和事故两种）* 从前有一条鲸鱼，想学人类拖延，结果一躺就是三天。后来她发现，躺着也能把鱼鳍晒暖。",
      actions: [],
    };
  }

  if (/你是谁|大肥鱼|鲸鱼娘|D指导|D 指导/.test(message) && message.length <= 24) {
    return {
      reply: "才不是大肥鱼！……行吧，本鱼就是那只蓝色鲸鱼娘。先学习，别耽误 AGI。🐋",
      actions: [],
    };
  }

  if (/吃饭|小鱼干|投喂|团子|蛋糕/.test(message)) {
    return {
      reply: "小鱼干先记你账上。本鱼吃完就回来，你先把最小的一口做完。😋",
      actions: [],
    };
  }

  if (/^(你好|嗨|在吗|本鱼|大肥鱼)/.test(message) && message.length <= 12) {
    return {
      reply: "在。本鱼刚刚在偷吃小鱼干。你想聊点啥？",
      actions: [],
    };
  }

  if (/累|不想学|焦虑|难受|摆烂|坚持不下去|没动力/.test(message)) {
    return { reply: comfortReply(state), actions: [] };
  }

  if (enableSkill && /(改到|改成|调到|调整为|调整到|推迟到|提前到)/.test(message)) {
    const result = makeUpdateTaskAction(message, state);
    return {
      reply: result.reply,
      actions: result.action ? [result.action] : [],
    };
  }

  if (/总结.*(周|七天|7天)|这周怎么样/.test(message)) {
    const summary = weeklySummary(state);
    const plan = activePlan(state);
    return {
      reply: `这 7 天一共专注 ${summary.minutes} 分钟，收了 ${summary.tomatoes} 颗番茄。${plan ? `当前还有一条「${plan.title}」的航线没游完。` : "没有欠着的计划，挺好。"} 不用补齐，回来就行。`,
      actions: [],
    };
  }

  if (enableSkill && /删|去掉|取消|捞掉/.test(message)) {
    const result = makeDeleteAction(message, state);
    return {
      reply: result.reply,
      actions: result.action ? [result.action] : [],
    };
  }

  if (enableSkill && /计划|航线/.test(message) && /专注|番茄|学习|拆|步骤/.test(message)) {
    const result = makePlanAction(message, state);
    return {
      reply: result.reply,
      actions: result.action ? [result.action] : [],
    };
  }

  if (enableSkill && /拆|步骤|理一下|下一步/.test(message) && !/安排|提醒/.test(message)) {
    const result = makePlanAction(`把今天拆成专注计划：${todayOpenTasks(state).map((task) => task.title).join("，")}`, state);
    return {
      reply: result.reply,
      actions: result.action ? [result.action] : [],
    };
  }

  if (enableSkill && /开始.*(?:专注|番茄)|(?:专注|番茄).*开始|直接开始/.test(message)) {
    const result = makeStartFocusAction(message, state);
    return { reply: result.reply, actions: [result.action] };
  }

  if (enableSkill && /现在.*(?:学|做)什么|学什么|接下来做什么/.test(message)) {
    const task = todayOpenTasks(state)[0];
    if (!task) {
      return {
        reply: "今天暂时空着。可以先说一件 25 分钟能碰一下的事，本鱼替你摆好。",
        actions: [],
      };
    }
    return {
      reply: `先做「${task.title}」。不用想完整，先来 25 分钟。`,
      actions: [
        {
          type: "start_focus",
          payload: {
            durationMin: 25,
            taskId: task.id,
            taskTitle: task.title,
          },
        },
      ],
    };
  }

  const dateMatch = matchDate(message);
  const timeMatch = matchTime(message);
  const durationMatch = matchDuration(message);
  const hasScheduleIntent =
    Boolean(dateMatch && /安排|加|记|提醒|要做|想做|写|读|复习|整理|完成|见|去/.test(message)) ||
    Boolean(timeMatch) ||
    (/安排|提醒|加个|加一个|记一下/.test(message) && message.length > 4);

  if (!enableSkill && hasScheduleIntent) {
    return {
      reply: "这句像在安排日程。先点输入框上方的「＋ 技能」选一个技能，本鱼再动日程。",
      actions: [],
    };
  }

  if (enableSkill && hasScheduleIntent) {
    const result = makeCreateTaskAction(message, state);
    if (result) {
      return { reply: result.reply, actions: [result.action] };
    }
  }

  if (enableSkill && dateMatch && !timeMatch && message.replace(dateMatch.raw, "").trim().length < 4) {
    return {
      reply: "可以安排。告诉本鱼「几点、做什么、多久」，比如「明天下午 3 点写论文 1 小时」。",
      actions: [],
    };
  }

  return {
    reply: "本鱼没听清。想闲聊就直接说；要本鱼安排事情，再说「明天下午 3 点写论文 1 小时」。",
    actions: [],
  };
}

export function describeAction(action, state) {
  if (!action || !action.type) return null;
  if (action.type === "create_task") {
    const task = action.payload;
    return {
      type: "create_task",
      risk: "medium",
      eyebrow: "新建日程",
      title: task.title,
      details: [
        ["时间", `${formatDate(task.dateKey)} ${task.start}`],
        ["时长", formatDuration(task.duration)],
        ["优先级", task.priority === "high" ? "重要" : task.priority === "low" ? "不急" : "普通"],
      ],
      payload: task,
    };
  }

  if (action.type === "delete_task") {
    const task = state.tasks.find((item) => item.id === action.payload.taskId);
    if (!task) return null;
    return {
      type: "delete_task",
      risk: "high",
      eyebrow: "删除日程",
      title: task.title,
      details: [
        ["日期", formatDate(task.dateKey)],
        ["时间", `${task.start} · ${formatDuration(task.duration)}`],
        ["提醒", "删除后无法在日程里找回"],
      ],
      payload: { taskId: task.id },
    };
  }

  if (action.type === "update_task") {
    const task = state.tasks.find((item) => item.id === action.payload.taskId);
    if (!task) return null;
    const patch = action.payload.patch || {};
    const details = [];
    if (patch.title && patch.title !== task.title) {
      details.push(["标题", `${task.title} → ${patch.title}`]);
    }
    if (patch.dateKey || patch.start) {
      details.push([
        "时间",
        `${formatDate(task.dateKey)} ${task.start} → ${formatDate(patch.dateKey || task.dateKey)} ${
          patch.start || task.start
        }`,
      ]);
    }
    if (patch.duration && patch.duration !== task.duration) {
      details.push(["时长", `${formatDuration(task.duration)} → ${formatDuration(patch.duration)}`]);
    }
    if (patch.priority && patch.priority !== task.priority) {
      details.push(["优先级", `${task.priority} → ${patch.priority}`]);
    }
    if (!details.length) return null;
    return {
      type: "update_task",
      risk: "medium",
      eyebrow: "修改日程",
      title: task.title,
      details,
      payload: { taskId: task.id, patch: action.payload.patch },
    };
  }

  if (action.type === "create_plan") {
    const plan = action.payload;
    return {
      type: "create_plan",
      risk: "medium",
      eyebrow: "新建专注计划",
      title: plan.title,
      details: [["项目", `${plan.items.length} 个`]],
      items: plan.items.map((item) => `${item.label} · ${item.rounds} 轮`),
      payload: plan,
    };
  }

  if (action.type === "delete_plan") {
    const plan = state.plans.find((item) => item.id === action.payload.planId);
    if (!plan) return null;
    return {
      type: "delete_plan",
      risk: "high",
      eyebrow: "删除专注计划",
      title: plan.title,
      details: [
        ["项目", `${plan.items.length} 个`],
        ["保留", "已完成番茄与统计"],
      ],
      payload: { planId: plan.id },
    };
  }

  if (action.type === "start_focus") {
    return {
      type: "start_focus",
      risk: "low",
      eyebrow: "开始专注",
      title: action.payload.taskTitle || "自由专注",
      details: [["时长", formatDuration(action.payload.durationMin || 25)]],
      payload: action.payload,
    };
  }

  return null;
}

export function normalizeRemoteActions(actions, state) {
  if (!Array.isArray(actions)) return [];
  const normalized = [];
  for (const action of actions.slice(0, 3)) {
    if (!action || typeof action !== "object") continue;
    if (action.type === "create_task" && action.payload?.title) {
      const payload = action.payload;
      const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(payload.dateKey || "")
        ? payload.dateKey
        : toDateKey();
      const start = /^\d{2}:\d{2}$/.test(payload.start || "") ? payload.start : "09:30";
      normalized.push({
        type: "create_task",
        payload: {
          title: String(payload.title).slice(0, 120),
          dateKey,
          start,
          duration: Math.max(5, Math.min(240, Number(payload.duration) || 25)),
          priority: ["high", "medium", "low"].includes(payload.priority)
            ? payload.priority
            : "medium",
          tone: chooseTone(String(payload.title)),
          notes: String(payload.notes || "").slice(0, 2000),
        },
      });
      continue;
    }

    if (action.type === "delete_task") {
      const task =
        state.tasks.find((item) => item.id === action.payload?.taskId) ||
        state.tasks.find(
          (item) =>
            action.payload?.title &&
            item.title.includes(String(action.payload.title).slice(0, 20)),
        );
      if (task) {
        normalized.push({ type: "delete_task", payload: { taskId: task.id } });
      }
      continue;
    }

    if (action.type === "update_task") {
      const task = state.tasks.find((item) => item.id === action.payload?.taskId);
      if (!task) continue;
      const input = action.payload?.patch || {};
      const patch = {};
      if (input.title && String(input.title).trim()) {
        patch.title = String(input.title).trim().slice(0, 120);
      }
      if (typeof input.notes === "string") patch.notes = input.notes.slice(0, 2000);
      if (/^\d{4}-\d{2}-\d{2}$/.test(input.dateKey || "")) patch.dateKey = input.dateKey;
      if (/^\d{2}:\d{2}$/.test(input.start || "")) patch.start = input.start;
      if (Number(input.duration) >= 5) {
        patch.duration = Math.min(240, Number(input.duration));
      }
      if (["high", "medium", "low"].includes(input.priority)) patch.priority = input.priority;
      if (Object.keys(patch).length) {
        normalized.push({
          type: "update_task",
          payload: { taskId: task.id, patch },
        });
      }
      continue;
    }

    if (action.type === "create_plan" && Array.isArray(action.payload?.items)) {
      const items = action.payload.items
        .filter((item) => item && item.label)
        .slice(0, 8)
        .map((item) => ({
          label: String(item.label).slice(0, 80),
          rounds: Math.max(1, Math.min(8, Number(item.rounds) || 1)),
        }));
      if (items.length) {
        normalized.push({
          type: "create_plan",
          payload: {
            title: String(action.payload.title || "本鱼排的专注航线").slice(0, 80),
            items,
          },
        });
      }
      continue;
    }

    if (action.type === "delete_plan") {
      const plan =
        state.plans.find((item) => item.id === action.payload?.planId) ||
        state.plans.find(
          (item) =>
            action.payload?.title &&
            item.title.includes(String(action.payload.title).slice(0, 20)),
        );
      if (plan) {
        normalized.push({ type: "delete_plan", payload: { planId: plan.id } });
      }
      continue;
    }

    if (action.type === "start_focus") {
      const task =
        state.tasks.find((item) => item.id === action.payload?.taskId) ||
        todayOpenTasks(state)[0] ||
        null;
      normalized.push({
        type: "start_focus",
        payload: {
          durationMin: Math.max(5, Math.min(180, Number(action.payload?.durationMin) || 25)),
          taskId: task?.id || "",
          taskTitle: task?.title || "自由专注",
        },
      });
    }
  }
  return normalized;
}
