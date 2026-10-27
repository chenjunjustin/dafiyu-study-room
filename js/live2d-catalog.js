// Interaction catalog derived from Andersen216/dsh-whale-girl-live2d
// and the model author's VTube Studio hotkey sheet.

export const LIVE2D_PARAM_MAPS = {
  love: { love: 1 },
  兔兔贴纸: { ParamCheek82: 1 },
  单边马尾: { fx1: 1 },
  双手比耶: { phone7: 1 },
  吐舌: {
    ParamBrowRForm2: 0,
    ParamCheek79: 1,
    ParamMouthForm: 0.9735565781593323,
    ParamMouthOpenY: 0.7558661103248596,
  },
  吐魂: { ParamCheek18: 1 },
  呆呆眼: { ParamCheek20: 1 },
  哭: {
    ParamCheek20: 1,
    ParamCheek27: 1,
    ParamCheek23: 1,
    ParamBrowLX: 0,
    ParamBrowLY: -0.3,
    ParamBrowLAngle: 0.25,
    ParamBrowLForm: -1,
    ParamBrowRX: 0,
    ParamBrowRY: -0.3,
    ParamBrowRAngle: 0.25,
    ParamBrowRForm: -1,
  },
  "喵喵手~喵~动画": { maoshou: 1 },
  圆眼镜: { ParamCheek70: 1 },
  墨镜: { ParamCheek71: 1, ParamEyeLOpen: -1, ParamEyeROpen: -1 },
  头箍: { ParamCheek38: 3 },
  巴菲: { baleite: 1 },
  开心兴奋: {
    ParamCheek76: 1,
    ParamEyeLOpen: 0,
    ParamEyeROpen: 0,
    ParamBrowLX: -1,
    ParamBrowLY: -0.8,
    ParamBrowLAngle: -1,
    ParamBrowLForm: -0.6,
    ParamBrowRX: -1,
    ParamBrowRY: -0.8,
    ParamBrowRAngle: -1,
    ParamBrowRForm: -0.6,
    ParamMouthForm: 1.5,
  },
  心跳: { ParamCheek73: 1 },
  悲伤: {
    ParamCheek15: 1,
    ParamBrowLAngle: 0.3,
    ParamBrowLForm: -1,
    ParamBrowRAngle: 0.3,
    ParamBrowRForm: -1,
    ParamMouthForm: -1.5,
  },
  情绪花花: { ParamCheek26: 360 },
  感叹号: { ParamCheek75: 1 },
  手机换色: { shouji: 1 },
  挤: { ji: 1 },
  撤回: { chehui: 1 },
  方眼镜: { ParamCheek72: 1 },
  星星眼: { ParamCheek16: 1 },
  晕晕: {
    ParamCheek77: 1,
    ParamEyeLOpen: -0.5,
    ParamEyeROpen: -0.5,
    ParamBrowLY: 0,
    ParamBrowLForm: 1,
    ParamBrowRY: 0,
    ParamBrowRForm: 1,
  },
  椭圆眼镜: { ParamCheek10: 1 },
  橡皮: { pi: 1 },
  流汗: { ParamCheek19: 1 },
  深色桌布: { cc2: 1 },
  点菜按下: { pointZ: 1 },
  爱心眼: {
    ParamCheek15: 0,
    ParamCheek17: 1,
    Paramhh2: 1,
    ParamBrowLX: 0,
    ParamBrowLY: -0.3,
    ParamBrowLAngle: 0.2,
    ParamBrowLForm: -1,
    ParamBrowRX: 0,
    ParamBrowRY: -0.3,
    ParamBrowRAngle: 0.2,
    ParamBrowRForm: -1,
  },
  猫猫贴纸: { ParamCheek83: 1 },
  生气: {
    ParamCheek80: 1,
    ParamCheek23: 1,
    ParamBrowLX: -1,
    ParamBrowLY: -0.5,
    ParamBrowLAngle: -1,
    ParamBrowLForm: -0.6,
    ParamBrowRX: -1,
    ParamBrowRY: -0.45,
    ParamBrowRAngle: -1,
    ParamBrowRForm: -0.7,
  },
  画笔: { bi: 1 },
  脸红: { Paramhh2: 1 },
  蛋包饭: { point: -1, danbaofan: 1 },
  蝴蝶结贴纸: { ParamCheek81: 1 },
  调皮: { ParamCheek21: 1, ParamEyeROpen: -1, ParamMouthForm: 1.5 },
  闭眼口水: { ParamCheek22: 1 },
  问号: { ParamCheek74: 1 },
  阴暗: { Paramhh3: 1 },
  魔爪: { mozhua: 1 },
  魔爪换色: { mozhua2: 1 },
  鲸鱼: { jingyu: 1 },
  鲸鱼放桌上: { fangzhuoshang: 1 },
  手机模式: { phone: 1, phone4: 0.478, phone6: -10 },
};

export const LIVE2D_EXPRESSION_ALIASES = {
  happy: "开心兴奋",
  blush: "脸红",
  love: "爱心眼",
  stars: "星星眼",
  sweat: "流汗",
  angry: "生气",
  sad: "悲伤",
  tongue: "吐舌",
  question: "问号",
  surprise: "感叹号",
  dizzy: "晕晕",
  whale: "鲸鱼",
  喵喵手: "喵喵手~喵~动画",
};

export const LIVE2D_FACE_ITEMS = [
  { id: "开心兴奋", label: "开心", effect: ["✦", "✧", "♪"] },
  { id: "脸红", label: "脸红", effect: ["♡", "♡", "✿"] },
  { id: "爱心眼", label: "爱心眼", effect: ["♥", "♥", "♡"] },
  { id: "星星眼", label: "星星眼", effect: ["✦", "✧", "★"] },
  { id: "流汗", label: "流汗", effect: ["💧", "💧"] },
  { id: "生气", label: "生气", effect: ["💢", "＃"] },
  { id: "悲伤", label: "委屈", effect: ["💧", "…"] },
  { id: "哭", label: "大哭", effect: ["💧", "💧", "💧"] },
  { id: "吐舌", label: "吐舌", effect: ["😋", "♪"] },
  { id: "问号", label: "问号", effect: ["?", "?"] },
  { id: "感叹号", label: "震惊", effect: ["!", "!"] },
  { id: "晕晕", label: "晕晕", effect: ["💫", "✧"] },
  { id: "调皮", label: "调皮 wink", effect: ["✦", "♪"] },
  { id: "闭眼口水", label: "困困", effect: ["💤", "…"] },
  { id: "吐魂", label: "累瘫", effect: ["👻", "…"] },
  { id: "阴暗", label: "阴暗", effect: ["…", "▁"] },
  { id: "呆呆眼", label: "呆住", effect: ["○", "○"] },
];

export const LIVE2D_PROP_ITEMS = [
  { id: "glassesRound", label: "圆眼镜", expr: "圆眼镜", group: "glasses" },
  { id: "glassesSquare", label: "方眼镜", expr: "方眼镜", group: "glasses" },
  { id: "glassesOval", label: "椭圆眼镜", expr: "椭圆眼镜", group: "glasses" },
  { id: "glassesSun", label: "墨镜", expr: "墨镜", group: "glasses" },
  { id: "stickerCat", label: "猫猫贴纸", expr: "猫猫贴纸", group: "sticker" },
  { id: "stickerRabbit", label: "兔兔贴纸", expr: "兔兔贴纸", group: "sticker" },
  { id: "stickerBow", label: "蝴蝶结贴纸", expr: "蝴蝶结贴纸", group: "sticker" },
  { id: "flower", label: "情绪花花", expr: "情绪花花", group: "headwear" },
  { id: "ponytail", label: "单边马尾", expr: "单边马尾", group: "hair" },
  { id: "headband", label: "发箍", expr: "头箍", group: "headwear" },
  { id: "whaleHat", label: "头顶鲸鱼", expr: "鲸鱼" },
];

export const LIVE2D_SCENE_ITEMS = [
  { id: "darkCloth", label: "深色桌布", expr: "深色桌布", group: "cloth" },
  { id: "whaleOnDesk", label: "鲸鱼放桌上", expr: "鲸鱼放桌上" },
  { id: "parfait", label: "桌面巴菲", expr: "巴菲" },
  { id: "claws", label: "粉魔爪", expr: "魔爪", group: "claw", clears: ["clawsWhite"] },
  { id: "clawsWhite", label: "白魔爪", expr: "魔爪换色", group: "clawColor", requires: "claws" },
  { id: "phone", label: "掏出手机", expr: "手机模式", group: "device", motion: "openLid" },
  {
    id: "phoneSkin",
    label: "手机换色",
    expr: "手机换色",
    group: "phoneSkin",
    requires: "phone",
  },
];

export const LIVE2D_ACTION_ITEMS = [
  { id: "paw", label: "猫爪摆手", motion: "idle", duration: 4400, effect: ["✦"] },
  {
    id: "catPaw",
    label: "喵喵手",
    expression: "喵喵手~喵~动画",
    effect: ["🐾", "♡"],
  },
  { id: "doubleV", label: "双手比耶", expression: "双手比耶", effect: ["✌", "✦"] },
  { id: "love", label: "冒爱心", expression: "love", effect: ["♥", "♥", "♡"] },
  { id: "heartbeat", label: "心跳", expression: "心跳", effect: ["♥", "♥"] },
  { id: "squeeze", label: "MoeMoeQ", expression: "挤", effect: ["✦", "♡"] },
  { id: "eraser", label: "橡皮擦", expression: "橡皮", effect: ["✦"] },
  { id: "undo", label: "撤回", expression: "撤回", effect: ["↶"] },
  {
    id: "omurice",
    label: "蛋包饭",
    expression: "蛋包饭",
    motion: "ketchup",
    duration: 6200,
    effect: ["🍳", "♥"],
  },
  { id: "selfie", label: "自拍", motion: "selfie", duration: 3400, requires: "phone" },
  {
    id: "selfieQuick",
    label: "快速自拍",
    motion: "selfieQuick",
    duration: 1900,
    requires: "phone",
  },
  { id: "splash", label: "鲸鱼喷水", motion: "splash", duration: 2100, effect: ["💦", "🫧"] },
  { id: "pointBoard", label: "点菜板", expression: "点菜按下", effect: ["📋"] },
  { id: "pen", label: "拿笔", expression: "画笔", effect: ["✎"] },
  { id: "stretch", label: "伸展", motion: "aidale", duration: 4700 },
  { id: "bubble", label: "吹泡泡糖", motion: "bubble", duration: 5000, effect: ["🫧", "🫧"] },
  { id: "openLid", label: "开盖", motion: "openLid", duration: 1200, effect: ["✦"] },
  { id: "selfieMotion", label: "自拍动作", motion: "selfie", duration: 3400 },
  { id: "selfieQuickMotion", label: "快速自拍动作", motion: "selfieQuick", duration: 1900 },
];

export const LIVE2D_MOTION_ITEMS = [
  { id: "idle", label: "猫爪待机" },
  { id: "aidale", label: "伸展" },
  { id: "selfie", label: "自拍" },
  { id: "selfieQuick", label: "快速自拍" },
  { id: "ketchup", label: "挤番茄酱" },
  { id: "openLid", label: "开盖" },
  { id: "bubble", label: "吹泡泡糖" },
  { id: "splash", label: "鲸鱼喷水" },
];

export const LIVE2D_MOTION_DURATIONS = {
  idle: 4,
  aidale: 4.767,
  selfie: 3.3,
  selfieQuick: 1.267,
  ketchup: 5,
  openLid: 1,
  bubble: 5,
  splash: 0.467,
};

export const LIVE2D_MOTION_IDS = new Set(LIVE2D_MOTION_ITEMS.map((item) => item.id));
export const LIVE2D_PROP_KEYS = new Set([
  ...LIVE2D_PROP_ITEMS.map((item) => item.id),
  ...LIVE2D_SCENE_ITEMS.map((item) => item.id),
]);
export const LIVE2D_EXPRESSION_NAMES = new Set(Object.keys(LIVE2D_PARAM_MAPS));
export const LIVE2D_FACE_NAMES = new Set(LIVE2D_FACE_ITEMS.map((item) => item.id));

export function resolveLive2DExpression(name) {
  const resolved = LIVE2D_EXPRESSION_ALIASES[name] || name;
  return LIVE2D_PARAM_MAPS[resolved] ? resolved : null;
}

export function live2DPropById(id) {
  return (
    LIVE2D_PROP_ITEMS.find((item) => item.id === id) ||
    LIVE2D_SCENE_ITEMS.find((item) => item.id === id) ||
    null
  );
}

export function live2DActionById(id) {
  return LIVE2D_ACTION_ITEMS.find((item) => item.id === id) || null;
}
