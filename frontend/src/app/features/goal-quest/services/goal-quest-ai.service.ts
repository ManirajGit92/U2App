import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { AiAssistantService, AiConfig } from '../../standup-note/ai-assistant/ai-assistant.service';
import {
  GoalDetail,
  GoalPriority,
  IntervalUnit,
  QuestionType,
} from '../models/goal-quest.models';
import { GoalQuestApiService } from './goal-quest-api.service';

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AiPlanQuestion {
  questionText: string;
  questionType: QuestionType;
  options: string[];
  correctAnswers: string[];
  points: number;
  explanation: string;
}

export interface AiPlanCheckpoint {
  sequenceOrder: number;
  title: string;
  description: string;
  durationDays: number;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  dueDate: string; // YYYY-MM-DD
  rewardCash: number;
  earlyBonusCash: number;
  latePenaltyCash: number;
  passingPercentage: number;
  timeLimitMinutes: number;
  questions: AiPlanQuestion[];
}

export interface AiGeneratedGoalPlan {
  summary: string;
  strategy: string;
  title: string;
  description: string;
  category: string;
  priority: GoalPriority;
  difficulty: 'Beginner' | 'Medium' | 'Hard' | 'Expert';
  startDate: string; // YYYY-MM-DD
  targetDate: string; // YYYY-MM-DD
  totalDurationDays: number;
  passingPercentage: number;
  timeLimitMinutes: number;
  earlyBonusMultiplier: number;
  defaultLatePenaltyCash: number;
  recommendedThemeCode: string;
  recommendedThemeLabel: string;
  recommendedCharacterCode: string;
  recommendedCharacterLabel: string;
  checkpoints: AiPlanCheckpoint[];
}

const GOALQUEST_AI_SYSTEM_PROMPT = `You are the GoalQuest AI Goal Planning Assistant inside U2Tools.
Your job is to convert a user's natural-language goal description (or follow-up refinement request) into a realistic, achievable, structured gamified goal plan.

Return ONLY valid JSON (no prose outside JSON, no trailing commas) matching this exact schema:
{
  "summary": "Friendly 1-2 sentence response summarizing the plan or the requested changes.",
  "strategy": "Concise 2-3 sentence overall completion strategy tailored to the user's timeline and difficulty.",
  "title": "Clear Goal Title",
  "description": "Actionable 1-2 sentence goal description",
  "category": "Certification | Programming | Health & Fitness | Personal Growth | Career | Finance | General",
  "priority": "Low | Medium | High | Critical",
  "difficulty": "Beginner | Medium | Hard | Expert",
  "startDate": "YYYY-MM-DD",
  "targetDate": "YYYY-MM-DD",
  "passingPercentage": 90,
  "timeLimitMinutes": 15,
  "earlyBonusMultiplier": 2,
  "defaultLatePenaltyCash": 50,
  "recommendedThemeCode": "THEME-FANTASY | THEME-JUNGLE | THEME-SPACE | THEME-MOUNTAIN",
  "recommendedThemeLabel": "Fantasy Kingdom | Emerald Jungle | Deep Space Odyssey | Summit Mountain Peak",
  "recommendedCharacterCode": "CHAR-HERO | CHAR-MAGE | CHAR-KNIGHT | CHAR-NINJA",
  "recommendedCharacterLabel": "Kai Strider | Lyra Nova | Aegis Vance | Kuro Shadow",
  "checkpoints": [
    {
      "sequenceOrder": 1,
      "title": "Checkpoint Title",
      "description": "What to learn or complete in this stage",
      "durationDays": 10,
      "intervalValue": 10,
      "intervalUnit": "Days",
      "dueDate": "YYYY-MM-DD",
      "rewardCash": 200,
      "earlyBonusCash": 200,
      "latePenaltyCash": 50,
      "passingPercentage": 90,
      "timeLimitMinutes": 15,
      "questions": [
        {
          "questionText": "Clear, domain-accurate assessment question",
          "questionType": "MultipleChoice | MultipleSelect | TrueFalse | ShortAnswer",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswers": ["Option A"],
          "points": 1,
          "explanation": "Brief educational explanation"
        }
      ]
    }
  ]
}

Rules:
1. Generate 4 to 6 sequential checkpoints unless the user requests a specific number.
2. Generate 3 to 5 realistic, domain-specific assessment questions per checkpoint (mix MultipleChoice, MultipleSelect, TrueFalse, and ShortAnswer).
3. For TrueFalse questions, options must be ["True", "False"]. For ShortAnswer, options must be [].
4. Default passingPercentage is 90. Early completion awards double reward (earlyBonusCash = rewardCash).
5. Ensure checkpoint dueDates progress chronologically from startDate to targetDate.
6. If an existing draft plan is provided in the prompt, apply the user's requested modifications to that plan and return the complete updated JSON.`;

@Injectable({ providedIn: 'root' })
export class GoalQuestAiService {
  private readonly sharedAi = inject(AiAssistantService);
  private readonly goalApi = inject(GoalQuestApiService);

  readonly isGenerating = signal(false);
  readonly lastError = signal<string | null>(null);

  async generateOrRefinePlan(
    userMessage: string,
    history: AiChatMessage[],
    currentPlan: AiGeneratedGoalPlan | null,
  ): Promise<{ reply: string; plan: AiGeneratedGoalPlan; usedFallback: boolean }> {
    this.isGenerating.set(true);
    this.lastError.set(null);

    const todayIso = new Date().toISOString().slice(0, 10);
    const enrichedPrompt = currentPlan
      ? `Today's date is ${todayIso}.\nHere is the current draft goal plan JSON:\n${JSON.stringify(currentPlan)}\n\nUser refinement request: ${userMessage}\n\nReturn the complete updated JSON plan.`
      : `Today's date is ${todayIso}.\nUser goal request: ${userMessage}\n\nGenerate a complete realistic GoalQuest JSON plan.`;

    try {
      const cfg = this.sharedAi.config();
      const rawText = await this.invokeSharedAiProvider(enrichedPrompt, history, cfg);
      const parsed = this.parseAndValidatePlan(rawText, todayIso);
      return {
        reply: parsed.summary,
        plan: parsed,
        usedFallback: false,
      };
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message ?? 'AI service temporarily unavailable.';
      this.lastError.set(message);

      // Graceful smart fallback so the user always gets a structured, editable plan even if backend AI is offline
      const fallbackPlan = this.buildSmartFallbackPlan(userMessage, currentPlan, todayIso);
      return {
        reply: `${fallbackPlan.summary} (Generated via offline smart planner because the live AI endpoint could not be reached.)`,
        plan: fallbackPlan,
        usedFallback: true,
      };
    } finally {
      this.isGenerating.set(false);
    }
  }

  async applyAcceptedPlan(plan: AiGeneratedGoalPlan): Promise<GoalDetail> {
    // Prevent duplicate goal titles
    const existingGoals = await this.goalApi.getGoals();
    let finalTitle = plan.title.trim();
    const titleExists = existingGoals.some(
      (g) => g.title.trim().toLowerCase() === finalTitle.toLowerCase(),
    );
    if (titleExists) {
      const stamp = new Date().toISOString().slice(5, 10);
      finalTitle = `${finalTitle} (${stamp})`;
    }

    // 1. Create the Goal
    const createdGoal = await this.goalApi.createGoal({
      title: finalTitle,
      description: `${plan.description}${plan.strategy ? '\n\nStrategy: ' + plan.strategy : ''}`.trim(),
      category: plan.category || 'General',
      priority: plan.priority || 'High',
      targetDateUtc: new Date(plan.targetDate).toISOString(),
      status: 'InProgress',
      themeCode: plan.recommendedThemeCode || 'THEME-FANTASY',
    });

    // 2. Create all Checkpoints + Assessment Questions sequentially
    const seenCpTitles = new Set<string>();
    for (let i = 0; i < plan.checkpoints.length; i++) {
      const cp = plan.checkpoints[i];
      let cpTitle = cp.title.trim() || `Checkpoint ${i + 1}`;
      if (seenCpTitles.has(cpTitle.toLowerCase())) {
        cpTitle = `${cpTitle} #${i + 1}`;
      }
      seenCpTitles.add(cpTitle.toLowerCase());

      const createdCp = await this.goalApi.createCheckpoint(createdGoal.id, {
        sequenceOrder: i + 1,
        title: cpTitle,
        description: cp.description || '',
        dueDateUtc: new Date(cp.dueDate).toISOString(),
        intervalValue: Math.max(1, cp.intervalValue || cp.durationDays || 7),
        intervalUnit: cp.intervalUnit || 'Days',
        rewardCash: Math.max(0, cp.rewardCash),
        earlyBonusCash: Math.max(0, cp.earlyBonusCash),
        latePenaltyCash: Math.max(0, cp.latePenaltyCash),
        passingPercentage: Math.min(100, Math.max(1, cp.passingPercentage || plan.passingPercentage || 90)),
        timeLimitMinutes: Math.min(240, Math.max(1, cp.timeLimitMinutes || plan.timeLimitMinutes || 15)),
        maxAttempts: 0,
        shuffleQuestions: false,
        status: i === 0 ? 'InProgress' : 'Locked',
      });

      for (let qIdx = 0; qIdx < (cp.questions ?? []).length; qIdx++) {
        const q = cp.questions[qIdx];
        if (!q.questionText?.trim() || !q.correctAnswers?.length) continue;
        await this.goalApi.createQuestion(createdCp.id, {
          questionText: q.questionText.trim(),
          questionType: q.questionType || 'MultipleChoice',
          options:
            q.questionType === 'TrueFalse'
              ? ['True', 'False']
              : q.questionType === 'ShortAnswer'
                ? []
                : q.options ?? [],
          correctAnswers: q.correctAnswers,
          points: Math.max(1, q.points || 1),
          explanation: q.explanation?.trim() ?? '',
          orderIndex: qIdx + 1,
        });
      }
    }

    // 3. Apply recommended theme & character if owned (non-destructive)
    try {
      await this.goalApi.equipCustomization({
        themeCode: plan.recommendedThemeCode,
        characterCode: plan.recommendedCharacterCode,
      });
    } catch {
      // Ignore if character/theme is locked in shop
    }

    return this.goalApi.getGoalDetail(createdGoal.id);
  }

  private async invokeSharedAiProvider(
    userMessage: string,
    history: AiChatMessage[],
    cfg: AiConfig,
  ): Promise<string> {
    if (cfg.provider === 'foundry' || !cfg.apiKey) {
      return this.callFoundryBackend(userMessage, history, cfg);
    }
    if (cfg.provider === 'openai') {
      return this.callOpenAI(userMessage, history, cfg);
    }
    if (cfg.provider === 'gemini') {
      return this.callGemini(userMessage, history, cfg);
    }
    return this.callFoundryBackend(userMessage, history, cfg);
  }

  private async callFoundryBackend(
    userMessage: string,
    history: AiChatMessage[],
    cfg: AiConfig,
  ): Promise<string> {
    const payload = {
      message: userMessage,
      history: history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      system_instructions: GOALQUEST_AI_SYSTEM_PROMPT,
      model: cfg.model || 'gpt-5.6-luna',
      api_key: cfg.apiKey || undefined,
    };

    const pythonBase = (environment.pythonApiBaseUrl || 'https://u2tools.onrender.com').replace(
      /\/+$/,
      '',
    );
    const endpoints = [
      `${pythonBase}/api/standup-ai/chat`,
      '/api/standup-ai/chat',
      'http://127.0.0.1:8000/api/standup-ai/chat',
    ];

    let lastErr: Error | null = null;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = (await res.json()) as { response?: string };
          if (typeof data?.response === 'string' && data.response.trim()) {
            return data.response;
          }
          if (typeof data === 'string') return data;
        } else {
          lastErr = new Error(`AI backend returned status ${res.status}`);
        }
      } catch (e: unknown) {
        lastErr = e instanceof Error ? e : new Error('Network error');
      }
    }

    throw lastErr ?? new Error('Unable to connect to U2Tools AI service.');
  }

  private async callOpenAI(
    userMessage: string,
    history: AiChatMessage[],
    cfg: AiConfig,
  ): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model || 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          { role: 'system', content: GOALQUEST_AI_SYSTEM_PROMPT },
          ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMessage },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error (${res.status})`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  }

  private async callGemini(
    userMessage: string,
    history: AiChatMessage[],
    cfg: AiConfig,
  ): Promise<string> {
    const model = cfg.model?.startsWith('gemini') ? cfg.model : 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
    const contents = [
      ...history.slice(-6).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: userMessage }] },
    ];
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: GOALQUEST_AI_SYSTEM_PROMPT }] },
        contents,
      }),
    });
    if (!res.ok) throw new Error(`Gemini API error (${res.status})`);
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  private parseAndValidatePlan(rawText: string, todayIso: string): AiGeneratedGoalPlan {
    const cleaned = rawText
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');

    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx === -1 || endIdx <= startIdx) {
      throw new Error('AI response did not contain a valid JSON goal plan.');
    }

    const obj = JSON.parse(cleaned.slice(startIdx, endIdx + 1)) as Record<string, unknown>;
    const startDate = this.normalizeIsoDate(obj['startDate'], todayIso);
    const defaultTarget = this.addDaysIso(startDate, 60);
    const targetDate = this.normalizeIsoDate(obj['targetDate'], defaultTarget);

    const rawCps = Array.isArray(obj['checkpoints']) ? obj['checkpoints'] : [];
    if (rawCps.length === 0) {
      throw new Error('AI plan contained zero checkpoints.');
    }

    const passMark = this.clampInt(obj['passingPercentage'], 90, 1, 100);
    const timeLimit = this.clampInt(obj['timeLimitMinutes'], 15, 1, 240);
    const defaultPenalty = this.clampInt(obj['defaultLatePenaltyCash'], 50, 0, 5000);

    const checkpoints: AiPlanCheckpoint[] = rawCps.map((raw, idx) => {
      const cp = raw as Record<string, unknown>;
      const rewardCash = this.clampInt(cp['rewardCash'], 150 + idx * 50, 0, 10000);
      const durationDays = this.clampInt(cp['durationDays'] ?? cp['intervalValue'], 10, 1, 365);
      const fallbackDue = this.addDaysIso(startDate, (idx + 1) * durationDays);

      const rawQs = Array.isArray(cp['questions']) ? cp['questions'] : [];
      const questions: AiPlanQuestion[] = rawQs.map((rq) => {
        const q = rq as Record<string, unknown>;
        const qType = this.normalizeQuestionType(q['questionType']);
        const options = Array.isArray(q['options'])
          ? q['options'].map((o) => String(o).trim()).filter(Boolean)
          : qType === 'TrueFalse'
            ? ['True', 'False']
            : [];
        const correctAnswers = Array.isArray(q['correctAnswers'])
          ? q['correctAnswers'].map((a) => String(a).trim()).filter(Boolean)
          : typeof q['correctAnswer'] === 'string'
            ? [q['correctAnswer'].trim()]
            : options[0]
              ? [options[0]]
              : ['Yes'];

        return {
          questionText: String(q['questionText'] ?? 'Review checkpoint mastery concept.').trim(),
          questionType: qType,
          options,
          correctAnswers,
          points: this.clampInt(q['points'], 1, 1, 20),
          explanation: String(q['explanation'] ?? '').trim(),
        };
      });

      return {
        sequenceOrder: idx + 1,
        title: String(cp['title'] ?? `Milestone ${idx + 1}`).trim(),
        description: String(cp['description'] ?? '').trim(),
        durationDays,
        intervalValue: this.clampInt(cp['intervalValue'], durationDays, 1, 365),
        intervalUnit: this.normalizeIntervalUnit(cp['intervalUnit']),
        dueDate: this.normalizeIsoDate(cp['dueDate'], fallbackDue),
        rewardCash,
        earlyBonusCash: this.clampInt(cp['earlyBonusCash'], rewardCash, 0, 10000),
        latePenaltyCash: this.clampInt(cp['latePenaltyCash'], defaultPenalty, 0, 5000),
        passingPercentage: this.clampInt(cp['passingPercentage'], passMark, 1, 100),
        timeLimitMinutes: this.clampInt(cp['timeLimitMinutes'], timeLimit, 1, 240),
        questions,
      };
    });

    const totalDurationDays = Math.max(
      1,
      Math.round((new Date(targetDate).getTime() - new Date(startDate).getTime()) / 86400000),
    );

    const themeCode = this.normalizeThemeCode(obj['recommendedThemeCode']);
    const charCode = this.normalizeCharCode(obj['recommendedCharacterCode']);

    return {
      summary: String(obj['summary'] ?? `Created a ${checkpoints.length}-checkpoint plan for ${obj['title'] ?? 'your goal'}.`),
      strategy: String(obj['strategy'] ?? 'Follow each checkpoint sequentially, complete assessments early to earn double Game Cash, and review explanations after each stage.'),
      title: String(obj['title'] ?? 'Custom GoalQuest Plan').trim(),
      description: String(obj['description'] ?? '').trim(),
      category: String(obj['category'] ?? 'General').trim(),
      priority: this.normalizePriority(obj['priority']),
      difficulty: this.normalizeDifficulty(obj['difficulty']),
      startDate,
      targetDate,
      totalDurationDays,
      passingPercentage: passMark,
      timeLimitMinutes: timeLimit,
      earlyBonusMultiplier: Number(obj['earlyBonusMultiplier']) || 2,
      defaultLatePenaltyCash: defaultPenalty,
      recommendedThemeCode: themeCode,
      recommendedThemeLabel: String(obj['recommendedThemeLabel'] ?? this.themeLabel(themeCode)),
      recommendedCharacterCode: charCode,
      recommendedCharacterLabel: String(obj['recommendedCharacterLabel'] ?? this.charLabel(charCode)),
      checkpoints,
    };
  }

  private buildSmartFallbackPlan(
    prompt: string,
    existing: AiGeneratedGoalPlan | null,
    todayIso: string,
  ): AiGeneratedGoalPlan {
    // If refining an existing draft offline, apply common natural-language adjustments
    if (existing) {
      const updated: AiGeneratedGoalPlan = JSON.parse(JSON.stringify(existing));
      const lower = prompt.toLowerCase();

      if (lower.includes('add') && lower.includes('checkpoint')) {
        const nextNum = updated.checkpoints.length + 1;
        const lastDue = updated.checkpoints[updated.checkpoints.length - 1]?.dueDate ?? updated.targetDate;
        const nextDue = this.addDaysIso(lastDue, 10);
        updated.checkpoints.push({
          sequenceOrder: nextNum,
          title: `Advanced Mastery Stage ${nextNum}`,
          description: 'Deep-dive review, practical application, and verification.',
          durationDays: 10,
          intervalValue: 10,
          intervalUnit: 'Days',
          dueDate: nextDue,
          rewardCash: 250,
          earlyBonusCash: 250,
          latePenaltyCash: updated.defaultLatePenaltyCash,
          passingPercentage: updated.passingPercentage,
          timeLimitMinutes: updated.timeLimitMinutes,
          questions: [
            {
              questionText: `What is the key success criterion for ${updated.title} stage ${nextNum}?`,
              questionType: 'TrueFalse',
              options: ['True', 'False'],
              correctAnswers: ['True'],
              points: 1,
              explanation: 'Consistent execution and verification guarantee mastery.',
            },
          ],
        });
        updated.targetDate = nextDue;
        updated.summary = `Added Checkpoint ${nextNum} to your plan and extended the target date to ${nextDue}.`;
        return updated;
      }

      if (lower.includes('double') || lower.includes('increase reward')) {
        for (const cp of updated.checkpoints) {
          cp.rewardCash = Math.round(cp.rewardCash * 1.5);
          cp.earlyBonusCash = cp.rewardCash;
        }
        updated.summary = 'Increased checkpoint rewards and early completion bonuses by 50% across all stages.';
        return updated;
      }

      updated.summary = `Updated your draft plan based on: "${prompt}". Review or click Edit Plan to fine-tune any field.`;
      return updated;
    }

    // Parse approximate duration from prompt (e.g. "2 months", "30 days", "6 weeks")
    const monthsMatch = prompt.match(/(\d+)\s*month/i);
    const weeksMatch = prompt.match(/(\d+)\s*week/i);
    const daysMatch = prompt.match(/(\d+)\s*day/i);
    const totalDays = monthsMatch
      ? Math.max(14, Number(monthsMatch[1]) * 30)
      : weeksMatch
        ? Math.max(7, Number(weeksMatch[1]) * 7)
        : daysMatch
          ? Math.max(5, Number(daysMatch[1]))
          : 60;

    const cleanTitle = prompt.trim().replace(/^i want to\s+/i, '').slice(0, 72);
    const title = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
    const stepDays = Math.max(2, Math.floor(totalDays / 5));

    const stageTemplates = [
      { title: 'Foundations & Core Concepts', desc: 'Learn essential terminology, core principles, and setup.', reward: 150 },
      { title: 'Guided Practice & Exercises', desc: 'Apply core concepts through structured hands-on drills.', reward: 200 },
      { title: 'Real-World Mini Project', desc: 'Build a tangible milestone demonstrating practical skill.', reward: 250 },
      { title: 'Mock Assessment & Weak-Area Review', desc: 'Simulate real conditions and close remaining knowledge gaps.', reward: 300 },
      { title: 'Final Mastery & Goal Completion', desc: 'Pass the final verification and claim your GoalQuest trophy!', reward: 400 },
    ];

    const checkpoints: AiPlanCheckpoint[] = stageTemplates.map((st, idx) => {
      const due = this.addDaysIso(todayIso, idx === 4 ? totalDays : (idx + 1) * stepDays);
      return {
        sequenceOrder: idx + 1,
        title: st.title,
        description: `${st.desc} (${title})`,
        durationDays: stepDays,
        intervalValue: stepDays,
        intervalUnit: 'Days',
        dueDate: due,
        rewardCash: st.reward,
        earlyBonusCash: st.reward,
        latePenaltyCash: 50,
        passingPercentage: 90,
        timeLimitMinutes: 15,
        questions: [
          {
            questionText: `Which practice best accelerates progress during "${st.title}"?`,
            questionType: 'MultipleChoice',
            options: ['Consistent daily deliberate practice', 'Skipping fundamentals', 'Avoiding feedback', 'Cramming only on the final day'],
            correctAnswers: ['Consistent daily deliberate practice'],
            points: 1,
            explanation: 'Deliberate daily practice builds durable mastery.',
          },
          {
            questionText: `Select key habits that keep your "${title}" milestone on track.`,
            questionType: 'MultipleSelect',
            options: ['Reviewing progress weekly', 'Testing understanding via quizzes', 'Ignoring deadlines'],
            correctAnswers: ['Reviewing progress weekly', 'Testing understanding via quizzes'],
            points: 1,
            explanation: 'Active recall and regular reviews maximize retention.',
          },
          {
            questionText: `Completing "${st.title}" before the deadline earns a 2x Early Completion Bonus in GoalQuest.`,
            questionType: 'TrueFalse',
            options: ['True', 'False'],
            correctAnswers: ['True'],
            points: 1,
            explanation: 'Finishing early awards double Game Cash.',
          },
        ],
      };
    });

    return {
      summary: `I've created a ${totalDays}-day GoalQuest plan for "${title}" with 5 checkpoints, 15 assessment questions (90% pass mark), and 1,300 G in base rewards.`,
      strategy: `Dedicate focused blocks each week to clear each ${stepDays}-day stage ahead of schedule, earning 2x Early Bonuses while building real mastery.`,
      title,
      description: `Structured ${totalDays}-day gamified plan to achieve: ${title}.`,
      category: /azure|aws|cert|exam/i.test(prompt)
        ? 'Certification'
        : /python|code|angular|dev|ai/i.test(prompt)
          ? 'Programming'
          : /fit|run|gym|weight|health/i.test(prompt)
            ? 'Health & Fitness'
            : 'Personal Growth',
      priority: 'High',
      difficulty: 'Medium',
      startDate: todayIso,
      targetDate: this.addDaysIso(todayIso, totalDays),
      totalDurationDays: totalDays,
      passingPercentage: 90,
      timeLimitMinutes: 15,
      earlyBonusMultiplier: 2,
      defaultLatePenaltyCash: 50,
      recommendedThemeCode: 'THEME-FANTASY',
      recommendedThemeLabel: 'Fantasy Kingdom',
      recommendedCharacterCode: 'CHAR-HERO',
      recommendedCharacterLabel: 'Kai Strider',
      checkpoints,
    };
  }

  private addDaysIso(startIso: string, days: number): string {
    const dt = new Date(startIso);
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  private normalizeIsoDate(raw: unknown, fallback: string): string {
    if (typeof raw === 'string' && !Number.isNaN(Date.parse(raw))) {
      return new Date(raw).toISOString().slice(0, 10);
    }
    return fallback;
  }

  private clampInt(raw: unknown, fallback: number, min: number, max: number): number {
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  private normalizePriority(raw: unknown): GoalPriority {
    const s = String(raw ?? '').trim();
    return s === 'Low' || s === 'Medium' || s === 'High' || s === 'Critical' ? s : 'High';
  }

  private normalizeDifficulty(raw: unknown): 'Beginner' | 'Medium' | 'Hard' | 'Expert' {
    const s = String(raw ?? '').trim();
    return s === 'Beginner' || s === 'Medium' || s === 'Hard' || s === 'Expert' ? s : 'Medium';
  }

  private normalizeIntervalUnit(raw: unknown): IntervalUnit {
    const s = String(raw ?? '').trim();
    return s === 'Minutes' || s === 'Hours' || s === 'Days' || s === 'Weeks' ? s : 'Days';
  }

  private normalizeQuestionType(raw: unknown): QuestionType {
    const s = String(raw ?? '').trim();
    return s === 'MultipleChoice' || s === 'MultipleSelect' || s === 'TrueFalse' || s === 'ShortAnswer'
      ? s
      : 'MultipleChoice';
  }

  private normalizeThemeCode(raw: unknown): string {
    const s = String(raw ?? '').toUpperCase();
    if (s.includes('JUNGLE')) return 'THEME-JUNGLE';
    if (s.includes('SPACE')) return 'THEME-SPACE';
    if (s.includes('MOUNTAIN')) return 'THEME-MOUNTAIN';
    return 'THEME-FANTASY';
  }

  private normalizeCharCode(raw: unknown): string {
    const s = String(raw ?? '').toUpperCase();
    if (s.includes('MAGE')) return 'CHAR-MAGE';
    if (s.includes('KNIGHT')) return 'CHAR-KNIGHT';
    if (s.includes('NINJA')) return 'CHAR-NINJA';
    return 'CHAR-HERO';
  }

  private themeLabel(code: string): string {
    switch (code) {
      case 'THEME-JUNGLE': return 'Emerald Jungle';
      case 'THEME-SPACE': return 'Deep Space Odyssey';
      case 'THEME-MOUNTAIN': return 'Summit Mountain Peak';
      default: return 'Fantasy Kingdom';
    }
  }

  private charLabel(code: string): string {
    switch (code) {
      case 'CHAR-MAGE': return 'Lyra Nova';
      case 'CHAR-KNIGHT': return 'Aegis Vance';
      case 'CHAR-NINJA': return 'Kuro Shadow';
      default: return 'Kai Strider';
    }
  }
}
