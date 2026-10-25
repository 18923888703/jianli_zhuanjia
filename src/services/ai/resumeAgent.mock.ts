import { delay } from "@/lib/utils";
import type {
  AnalysisResult,
  FollowUpMessage,
  OptimizeStyle,
  UserInput,
} from "@/types/resume";

const STYLE_LABELS: Record<OptimizeStyle, string> = {
  concise: "更简洁",
  "reduce-exaggeration": "降低夸张",
  "ai-product": "更偏 AI 产品",
  "tob-saas": "更偏 ToB SaaS",
};

const JD_HEADING = /^(岗位职责|工作职责|工作内容|职位描述|主要职责|你将负责|responsibilities)\s*[:：]?$/i;
const REQUIREMENT_HEADING = /^(任职要求|岗位要求|职位要求|任职资格|基本要求|资格要求|加分项|优先条件|qualifications|requirements)\s*[:：]?$/i;
const BULLET_PREFIX = /^(?:[-*•·▪●‣]|\d+[.、)、]|[（(]\d+[）)])\s*/;
const STOP_WORDS = ["负责", "具备", "能力", "经验", "要求", "优先", "熟悉", "了解", "能够", "工作", "相关", "以上", "以下", "良好", "优秀", "以及", "进行", "通过", "推动", "支持"];

function splitJD(input: string) {
  const lines = input
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((line) => line.trim().replace(BULLET_PREFIX, "").trim())
    .filter(Boolean);
  const responsibilities: string[] = [];
  const requirements: string[] = [];
  let section: "responsibilities" | "requirements" | "other" = "other";

  for (const line of lines) {
    if (JD_HEADING.test(line)) {
      section = "responsibilities";
      continue;
    }
    if (REQUIREMENT_HEADING.test(line)) {
      section = "requirements";
      continue;
    }
    const parts = line.length > 180 ? line.split(/(?<=[。；;])\s*/) : [line];
    for (const part of parts.map((item) => item.trim()).filter((item) => item.length >= 5)) {
      if (section === "responsibilities") responsibilities.push(part);
      else if (section === "requirements") requirements.push(part);
      else requirements.push(part);
    }
  }

  const unique = (items: string[]) => [...new Set(items)].slice(0, 12);
  const all = unique([...responsibilities, ...requirements]);
  return {
    responsibilities: unique(responsibilities.length ? responsibilities : all),
    requirements: unique(requirements.length ? requirements : all),
  };
}

function extractTerms(text: string) {
  const english = text.match(/[A-Za-z][A-Za-z0-9+#./-]*/g) ?? [];
  const chinese: string[] = [];
  for (const sequence of text.match(/[\u4e00-\u9fff]{2,}/g) ?? []) {
    for (let size = 2; size <= Math.min(5, sequence.length); size++) {
      for (let start = 0; start + size <= sequence.length; start++) {
        const term = sequence.slice(start, start + size);
        if (!STOP_WORDS.some((stop) => term.includes(stop))) chinese.push(term);
      }
    }
  }
  const counts = new Map<string, number>();
  for (const term of [...english, ...chinese]) {
    const normalized = term.toLowerCase();
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([term]) => term)
    .filter((term, index, allTerms) => !allTerms.some((other, otherIndex) => otherIndex < index && other.includes(term)))
    .slice(0, 16);
}

function buildJDAnalysis(input: UserInput): AnalysisResult["jdAnalysis"] {
  const { responsibilities, requirements } = splitJD(input.jobDescription);
  const keywords = extractTerms(`${input.targetRole}\n${input.jobDescription}`);
  const competencies = requirements.slice(0, 5).map((item, index) => ({
    name: item.length > 22 ? `${item.slice(0, 22)}…` : item,
    importance: index < 2 ? "high" as const : index < 4 ? "medium" as const : "low" as const,
    description: `来自当前 JD：${item}`,
  }));

  return {
    responsibilities,
    hardRequirements: requirements,
    implicitRequirements: [
      `候选人需要能用简历中的具体经历证明与“${input.targetRole || "目标岗位"}”相关的要求。`,
      "面试中应补充职责范围、本人贡献和可验证的结果数据。",
    ],
    keywords,
    idealCandidate: `能用真实经历证明符合「${input.targetRole || "目标岗位"}」JD 的候选人。建议重点准备：${requirements.slice(0, 3).join("；") || "补充 JD 中的核心要求"}`,
    coreCompetencies: competencies,
  };
}

function buildDiagnosis(input: UserInput, matchItems: AnalysisResult["matchItems"]): AnalysisResult["diagnosis"] {
  const coverage = matchItems.length
    ? Math.round((matchItems.filter((item) => item.evidenceStrength === "strong" || item.evidenceStrength === "medium").length / matchItems.length) * 100)
    : 0;
  const missing = matchItems.filter((item) => item.needsSupplement);
  const averageLength = input.originalResume.trim().length;
  const score = Math.max(25, Math.min(95, Math.round(40 + coverage * 0.45 + Math.min(averageLength / 500, 8))));
  return {
    overallScore: score,
    dimensionScores: [
      {
        dimension: "岗位匹配度",
        score: coverage,
        comment: `按当前 JD 对照简历文本，约 ${coverage}% 的要求找到中等及以上的文字证据。Mock 模式仅做规则匹配。`,
      },
      {
        dimension: "经历表达",
        score: Math.max(30, Math.min(85, 45 + Math.min((input.originalResume.match(/\d+(?:\.\d+)?%?/g) ?? []).length * 4, 40))),
        comment: "基于当前简历中的量化数字粗略评估；Mock 模式不会改写经历。",
      },
      {
        dimension: "关键词覆盖",
        score: coverage,
        comment: `根据当前 JD 与简历中的词语重合情况估算，待补充要求 ${missing.length} 项。`,
      },
      {
        dimension: "结构完整性",
        score: Math.max(30, Math.min(85, 45 + Math.min((input.originalResume.match(/\n/g) ?? []).length, 40))),
        comment: "根据当前简历文本长度和分段数量估算，Mock 模式不理解具体经历语义。",
      },
      {
        dimension: "差异化亮点",
        score: Math.max(30, Math.min(85, 45 + Math.min(extractTerms(input.originalResume).length * 2, 40))),
        comment: "按当前简历中可识别的技能和业务词语数量估算。",
      },
    ],
    mainIssues: missing.length
      ? missing.slice(0, 5).map((item) => `当前简历未检索到「${item.jdRequirement}」的直接文字证据`)
      : ["规则匹配未发现明显缺口；仍需人工确认经历是否真实覆盖 JD 要求。"],
    prioritySuggestions: missing.length
      ? missing.slice(0, 5).map((item) => `补充能证明「${item.jdRequirement}」的项目、职责或量化结果；没有相关经历时不要臆造。`)
      : ["检查当前简历中的成果数据、本人贡献和 JD 关键词是否准确。"],
  };
}

function buildMatchItems(input: UserInput): AnalysisResult["matchItems"] {
  const { responsibilities, requirements } = splitJD(input.jobDescription);
  const lines = input.originalResume
    .split(/[\n。；;]+/)
    .map((line) => line.trim().replace(BULLET_PREFIX, ""))
    .filter((line) => line.length >= 4);
  const jdItems = [...new Set([...requirements, ...responsibilities])].slice(0, 12);

  return jdItems.map((requirement) => {
    const terms = extractTerms(requirement).filter((term) => term.length >= 3);
    const scoredLines = lines
      .map((line) => ({ line, hits: terms.filter((term) => line.toLowerCase().includes(term.toLowerCase())).length }))
      .filter((item) => item.hits > 0)
      .sort((a, b) => b.hits - a.hits);
    const hits = scoredLines[0]?.hits ?? 0;
    const evidenceStrength = hits >= 3 ? "strong" : hits >= 2 ? "medium" : hits === 1 ? "weak" : "none";
    return {
      jdRequirement: requirement,
      resumeEvidence: scoredLines[0]?.line ?? "当前简历中未检索到直接文字证据（Mock 规则匹配）",
      evidenceStrength,
      needsSupplement: hits < 2,
      optimizationSuggestion: hits
        ? `围绕「${requirement}」补充本人职责、行动和可验证结果，当前匹配依据为简历中的原文。`
        : `检查是否有真实经历可以证明「${requirement}」；没有则不要编造。`,
    };
  });
}

function buildFollowUpQuestions(): AnalysisResult["followUpQuestions"] {
  return [
    {
      id: "fu-1",
      question: "你的文档问答 Demo 具体解决了什么业务问题？用了哪些技术栈？",
      purpose: "挖掘 AI 实践经验",
      userAnswer: "",
      generatedBullet: "",
    },
    {
      id: "fu-2",
      question: "WMS 智能补货的「策略模型」具体是什么逻辑？有没有 A/B 测试或效果数据？",
      purpose: "强化智能化经历表达",
      userAnswer: "",
      generatedBullet: "",
    },
    {
      id: "fu-3",
      question: "经营数据报表平台中，你如何定义「报表生成效率提升 60%」？",
      purpose: "验证量化数据可信度",
      userAnswer: "",
      generatedBullet: "",
    },
    {
      id: "fu-4",
      question: "你有没有参与过需求优先级排序或 ROI 评估？具体案例？",
      purpose: "补充产品策略能力",
      userAnswer: "",
      generatedBullet: "",
    },
    {
      id: "fu-5",
      question: "与研发协作中，有没有遇到过技术方案与产品预期不一致的情况？如何解决？",
      purpose: "挖掘跨团队协作细节",
      userAnswer: "",
      generatedBullet: "",
    },
    {
      id: "fu-6",
      question: "你最近关注的 AI 产品有哪些？它们哪里做得好/不好？",
      purpose: "补充行业认知与竞品分析",
      userAnswer: "",
      generatedBullet: "",
    },
    {
      id: "fu-7",
      question: "ERP/WMS 经验中，哪个业务流程最复杂？你如何抽象成产品方案？",
      purpose: "强化 ToB 需求分析能力",
      userAnswer: "",
      generatedBullet: "",
    },
  ];
}

function buildOptimizedItems(
  style: OptimizeStyle = "ai-product"
): AnalysisResult["optimizedItems"] {
  const styleNote = STYLE_LABELS[style];

  return [
    {
      id: "opt-1",
      section: "职业摘要",
      before:
        "3.5年 B 端产品经理经验，主导 ERP 库存管理、WMS 仓储系统及经营数据报表平台的产品设计与迭代。擅长需求调研、流程梳理与跨部门协作，具备从 0 到 1 搭建数据产品的经验。",
      after:
        "3.5年 ToB SaaS 产品经理，深耕 ERP/WMS 及经营数据报表领域，服务 50+ 企业客户。具备从 0 到 1 搭建数据产品与智能化功能（智能补货策略）的完整经验，近期系统学习 LLM 应用与 Prompt 设计，独立完成内部文档问答 Demo，正将数据驱动的产品方法论延伸至 AI 产品场景。",
      reason: `按「${styleNote}」方向重写，建立 B 端经验与 AI 转型的叙事连接`,
      riskWarning: "Demo 项目需确保可演示，避免过度包装为「正式产品经验」",
    },
    {
      id: "opt-2",
      section: "工作经历 - WMS",
      before: "负责 WMS 仓储管理系统核心模块，服务 50+ 企业客户",
      after:
        "负责 WMS 仓储管理系统核心模块（入库/出库/盘点/补货）产品规划与迭代，覆盖 50+ 企业客户的 SaaS 标准化交付",
      reason: "补充模块范围与 SaaS 交付属性，增强 ToB 画像",
      riskWarning: "模块列表需与实际负责范围一致",
    },
    {
      id: "opt-3",
      section: "工作经历 - 盘点",
      before: "主导库存盘点功能重构，盘点效率提升 40%",
      after:
        "主导库存盘点流程重构（移动端扫码 + 差异自动核对），单次盘点耗时从 4h 降至 2.4h，效率提升 40%",
      reason: "增加方法论与具体数据，提升可信度",
      riskWarning: "时间数据需可溯源，面试可能被追问",
    },
    {
      id: "opt-4",
      section: "项目经历 - 智能补货",
      before: "基于历史销售数据设计补货策略模型，推动补货建议功能上线，缺货率下降 25%",
      after:
        "设计基于历史销售与季节性波动的智能补货策略（规则引擎 + 安全库存模型），经 3 个月 A/B 验证后全量上线，缺货率从 12% 降至 9%",
      reason: "将「智能补货」与 AI/智能化叙事对齐，补充验证过程",
      riskWarning: "规则引擎不等于 LLM，面试时需诚实说明技术方案",
    },
    {
      id: "opt-5",
      section: "新增 - AI 实践项目",
      before: "（简历中未体现）",
      after:
        "独立开发内部文档问答 Demo（LangChain + 向量检索 + GPT），支持产品文档语义搜索与问答，准确率达 85%，验证 RAG 方案在知识库场景的可行性",
      reason: "将补充信息中的 Demo 经验结构化写入，补齐 AI 经历缺口",
      riskWarning: "明确标注为 Demo/个人项目，避免误导为商业落地",
    },
    {
      id: "opt-6",
      section: "技能工具",
      before: "Axure、Figma、SQL、Jira、Confluence、数据分析",
      after:
        "产品：Axure、Figma、Jira | 数据：SQL、BI 报表 | AI：Prompt Engineering、LangChain（RAG Demo）、LLM 应用基础",
      reason: "分类展示并加入 AI 技能，对齐 JD 关键词",
      riskWarning: "AI 技能标注「基础/Demo 级」，避免夸大",
    },
  ];
}

function buildFinalResume(input: UserInput): AnalysisResult["finalResume"] {
  return {
    personalInfo: {
      name: "张明",
      email: "zhangming@email.com",
      phone: "138****5678",
      location: "上海",
    },
    jobIntent: `${input.targetRole} | ${input.industry}`,
    summary:
      "3.5年 ToB SaaS 产品经理，深耕 ERP/WMS 及经营数据报表领域，服务 50+ 企业客户。具备从 0 到 1 搭建数据产品与智能化功能（智能补货策略）的完整经验，近期系统学习 LLM 应用与 Prompt 设计，独立完成内部文档问答 Demo，正将数据驱动的产品方法论延伸至 AI 产品场景。",
    coreSkills: [
      "AI 产品规划与场景落地",
      "ToB 需求分析与业务流程抽象",
      "数据驱动决策与效果评估",
      "跨团队（研发/算法/实施）协作交付",
      "ERP/WMS/SaaS 产品全周期管理",
    ],
    workExperience: [
      {
        company: "某 SaaS 公司",
        role: "产品经理",
        period: "2021.06 - 至今",
        bullets: [
          "负责 WMS 仓储管理系统核心模块（入库/出库/盘点/补货）产品规划与迭代，覆盖 50+ 企业客户的 SaaS 标准化交付",
          "主导库存盘点流程重构（移动端扫码 + 差异自动核对），单次盘点耗时从 4h 降至 2.4h，效率提升 40%",
          "从 0 到 1 设计经营数据报表平台，支持 20+ 自定义模板，月活 200+，报表生成效率提升 60%",
          "协调研发、测试、实施团队，按时交付 3 个 Major 版本，零重大生产事故",
        ],
      },
      {
        company: "某软件公司",
        role: "产品助理",
        period: "2020.07 - 2021.05",
        bullets: [
          "参与 ERP 采购模块需求调研与原型设计，输出 15+ PRD 文档",
          "跟进开发进度与 UAT 测试，推动订单审批流程优化，审批周期缩短 30%",
          "建立客户反馈收集机制，月均处理 40+ 需求工单",
        ],
      },
    ],
    projectExperience: [
      {
        name: "内部文档问答 Demo",
        role: "独立开发者",
        period: "2024.10 - 2024.12",
        bullets: [
          "基于 LangChain + 向量检索 + GPT 构建 RAG 文档问答系统，支持产品文档语义搜索",
          "设计 Prompt 模板与检索策略，问答准确率达 85%",
          "验证 RAG 方案在企业知识库场景的可行性，为后续 AI 功能规划提供参考",
        ],
      },
      {
        name: "WMS 智能补货",
        role: "产品经理",
        period: "2023.01 - 2023.09",
        bullets: [
          "设计基于历史销售与季节性波动的智能补货策略（规则引擎 + 安全库存模型）",
          "经 3 个月 A/B 验证后全量上线，缺货率从 12% 降至 9%",
          "建立补货效果监控看板，支持策略参数动态调优",
        ],
      },
    ],
    skillsAndTools: [
      "Axure",
      "Figma",
      "SQL",
      "Jira",
      "Confluence",
      "Prompt Engineering",
      "LangChain",
      "LLM 应用基础",
    ],
    education: {
      school: "某大学",
      degree: "信息管理与信息系统 | 本科",
      period: "2016 - 2020",
    },
  };
}

function buildInterviewPrep(): AnalysisResult["interviewPrep"] {
  return {
    likelyQuestions: [
      {
        question: "你为什么想从传统 B 端 PM 转型做 AI 产品经理？",
        suggestedAnswer:
          "我的 WMS 智能补货和报表平台经历让我理解数据驱动的产品方法论。近期 LLM 能力成熟，我认为 AI 会重塑 ToB 产品交互，我的行业 know-how 加上 AI 能力可以创造更大价值。",
        evidenceNeeded: ["转型动机真实案例", "AI 学习路径与时间投入"],
      },
      {
        question: "你的文档问答 Demo 技术方案是什么？效果如何评估？",
        suggestedAnswer:
          "采用 RAG 架构：文档切片 → 向量检索 → Prompt 组装 → GPT 生成。准确率 85% 基于 50 条测试问答集的人工评估。",
        evidenceNeeded: ["Demo 可演示", "测试集样例", "失败 case 分析"],
      },
      {
        question: "智能补货的策略模型是 AI 吗？和 LLM 有什么关系？",
        suggestedAnswer:
          "当前是基于规则引擎和统计模型的智能化方案，不是 LLM。但它培养了我设计「输入→策略→输出→评估」闭环的方法论，可直接迁移到 AI 功能设计。",
        evidenceNeeded: ["策略逻辑细节", "A/B 测试数据", "与 AI 的方法论关联"],
      },
      {
        question: "如何评估一个 AI 功能是否值得做？",
        suggestedAnswer:
          "参考我的报表平台经验：先定义核心指标（准确率/采纳率/效率提升）→ MVP 验证 → 数据驱动迭代。AI 功能还需额外评估幻觉风险和人工 fallback 成本。",
        evidenceNeeded: ["指标框架", "MVP 案例", "ROI 思考"],
      },
      {
        question: "描述一个复杂需求从调研到上线的完整过程",
        suggestedAnswer: "以报表平台为例：客户访谈 → 竞品分析 → 拖拽配置器 MVP → 20 模板试点 → 全量推广",
        evidenceNeeded: ["PRD 片段", "里程碑时间线", "关键决策点"],
      },
      {
        question: "你和算法/研发团队如何协作？",
        suggestedAnswer:
          "在 WMS 项目中，我会先输出业务规则文档和数据字段定义，与研发对齐接口方案，再分 Sprint 交付。AI 协作会增加 Prompt 迭代和效果评估环节。",
        evidenceNeeded: ["协作文档样例", "分歧解决案例"],
      },
      {
        question: "你关注哪些 AI 产品？优缺点是什么？",
        suggestedAnswer:
          "关注 Notion AI、飞书智能助手、Coze。Notion AI 集成自然但能力边界模糊；飞书助手覆盖广但定制化不足。",
        evidenceNeeded: ["实际使用体验", "具体功能对比"],
      },
      {
        question: "盘点效率提升 40% 是怎么算的？",
        suggestedAnswer:
          "选取 10 家试点客户，对比重构前后单次全仓盘点平均耗时，从 4 小时降至 2.4 小时。",
        evidenceNeeded: ["试点客户数", "统计口径", "前后对比方法"],
      },
      {
        question: "你的劣势是什么？如何弥补？",
        suggestedAnswer:
          "正式 AI 产品落地经验不足。已通过 Demo 实践和系统学习弥补，并计划在下一份工作中从 AI 辅助功能切入。",
        evidenceNeeded: ["学习计划", "Demo 成果", "谦逊且积极的态度"],
      },
      {
        question: "你对我们公司和这个岗位了解多少？",
        suggestedAnswer: "提前研究公司 AI 产品布局、目标客户、与自身经验的契合点",
        evidenceNeeded: ["公司调研笔记", "产品体验记录", "针对性问题"],
      },
    ],
    evidenceToPrepare: [
      "文档问答 Demo 的可演示环境或录屏",
      "报表平台与智能补货的关键数据口径说明",
      "WMS 产品架构图或核心流程图",
      "Prompt 模板样例与迭代记录",
      "客户访谈或需求调研的方法论案例",
    ],
    possibleExaggerations: [
      "「智能补货策略模型」可能被理解为深度学习模型，需澄清为规则引擎",
      "「AI 产品经验」来自 Demo 而非商业落地，需主动说明",
      "「准确率 85%」的测试集规模和评估方法可能被追问",
      "「服务 50+ 企业客户」中个人贡献范围需明确",
    ],
    dataToSupplement: [
      "Demo 项目的测试集规模和评估方法论",
      "盘点效率提升的试点样本与统计口径",
      "报表平台月活 200+ 的定义（UV/PV/生成次数）",
      "Major 版本的具体功能清单与个人贡献",
    ],
    selfIntroduction:
      "您好，我是张明，有 3.5 年 ToB SaaS 产品经验，主导过 WMS 和经营数据报表平台。我在工作中设计了智能补货策略，近期系统学习 AI 并完成了文档问答 Demo。我希望将 B 端行业理解与 AI 产品能力结合，贵司的 AI 产品方向与我的经验高度契合，期待进一步交流。",
  };
}

export async function runMockResumeAnalysis(
  input: UserInput,
  optimizeStyle: OptimizeStyle = "ai-product"
): Promise<AnalysisResult> {
  await delay(1800);
  const matchItems = buildMatchItems(input);

  return {
    jdAnalysis: buildJDAnalysis(input),
    diagnosis: buildDiagnosis(input, matchItems),
    matchItems,
    followUpQuestions: buildFollowUpQuestions(),
    optimizedItems: buildOptimizedItems(optimizeStyle),
    finalResume: buildFinalResume(input),
    interviewPrep: buildInterviewPrep(),
  };
}

export async function runMockRegenerateOptimizedItems(
  style: OptimizeStyle
): Promise<AnalysisResult["optimizedItems"]> {
  await delay(800);
  return buildOptimizedItems(style);
}

export async function runMockFollowUpBullet(
  purpose: string,
  userAnswer: string
): Promise<string> {
  await delay(400);
  return `基于${purpose.replace(/[？?]/g, "")}，${userAnswer.trim().replace(/[。.!！]$/, "")}，体现 AI 产品落地能力与业务理解深度。`;
}

export async function runMockContinueFollowUp(
  purpose: string,
  messages: FollowUpMessage[]
): Promise<{ nextQuestion: string | null; readyToGenerate: boolean }> {
  await delay(300);
  const answerCount = messages.filter((message) => message.role === "user").length;
  if (answerCount >= 2) return { nextQuestion: null, readyToGenerate: true };

  const nextQuestion = purpose.includes("数据") || purpose.includes("量化")
    ? "这个结果是如何统计或验证的？请尽量补充时间范围和对比基准。"
    : "你具体采取了哪些步骤？最后产生了什么可验证的结果或影响？";
  return { nextQuestion, readyToGenerate: false };
}

export { STYLE_LABELS };
