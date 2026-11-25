import { Injectable } from '@angular/core';
import {
  ExcelValidationError,
  GoalQuestExcelWorkbook,
} from '../models/goal-quest.models';

type RawRow = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class GoalQuestExcelService {
  private async loadXlsx() {
    return await import('xlsx');
  }

  async parseExcelFile(file: File): Promise<GoalQuestExcelWorkbook> {
    const XLSX = await this.loadXlsx();
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

    const readSheet = (candidates: string[]): RawRow[] => {
      const sheetName = wb.SheetNames.find((name) =>
        candidates.some((c) => name.trim().toLowerCase() === c.toLowerCase()),
      );
      if (!sheetName) return [];
      const ws = wb.Sheets[sheetName];
      return XLSX.utils.sheet_to_json<RawRow>(ws, { defval: '' });
    };

    const str = (row: RawRow, ...keys: string[]): string => {
      for (const k of keys) {
        const match = Object.keys(row).find((rk) => rk.trim().toLowerCase() === k.toLowerCase());
        if (match !== undefined && row[match] !== null && row[match] !== undefined) {
          const val = row[match];
          if (val instanceof Date) {
            return val.toISOString().slice(0, 10);
          }
          return String(val).trim();
        }
      }
      return '';
    };

    const num = (row: RawRow, fallback: number, ...keys: string[]): number => {
      const s = str(row, ...keys);
      if (!s) return fallback;
      const parsed = Number(s);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const bool = (row: RawRow, fallback: boolean, ...keys: string[]): boolean => {
      const s = str(row, ...keys).toLowerCase();
      if (!s) return fallback;
      return s === 'true' || s === 'yes' || s === '1';
    };

    return {
      goals: readSheet(['Goals']).map((r, i) => ({
        rowNumber: i + 2,
        goalCode: str(r, 'GoalCode', 'Goal ID', 'Id'),
        title: str(r, 'Title', 'Goal Title'),
        description: str(r, 'Description'),
        category: str(r, 'Category') || 'General',
        priority: str(r, 'Priority') || 'Medium',
        targetDate: str(r, 'TargetDate', 'Target Date'),
        status: str(r, 'Status') || 'InProgress',
        themeCode: str(r, 'ThemeCode', 'Theme') || 'THEME-KINGDOM',
        backgroundImageUrl: str(r, 'BackgroundImageUrl', 'Background Image URL', 'BackgroundImage'),
      })),

      checkpoints: readSheet(['Checkpoints']).map((r, i) => ({
        rowNumber: i + 2,
        checkpointCode: str(r, 'CheckpointCode', 'Checkpoint ID'),
        goalCode: str(r, 'GoalCode', 'Goal ID'),
        sequenceOrder: num(r, i + 1, 'SequenceOrder', 'Order', 'Sequence'),
        title: str(r, 'Title', 'Checkpoint Title'),
        description: str(r, 'Description'),
        dueDate: str(r, 'DueDate', 'Due Date'),
        intervalValue: num(r, 7, 'IntervalValue'),
        intervalUnit: str(r, 'IntervalUnit') || 'Days',
        rewardCash: num(r, 100, 'RewardCash', 'Reward'),
        earlyBonusCash: num(r, 100, 'EarlyBonusCash', 'EarlyBonus'),
        latePenaltyCash: num(r, 50, 'LatePenaltyCash', 'LatePenalty'),
        passingPercentage: num(r, 90, 'PassingPercentage', 'PassMark'),
        timeLimitMinutes: num(r, 15, 'TimeLimitMinutes', 'TimeLimit'),
        status: str(r, 'Status') || 'Locked',
      })),

      assessmentQuestions: readSheet(['Assessment Questions', 'AssessmentQuestions']).map((r, i) => ({
        rowNumber: i + 2,
        questionCode: str(r, 'QuestionCode', 'Question ID'),
        checkpointCode: str(r, 'CheckpointCode', 'Checkpoint ID'),
        questionText: str(r, 'QuestionText', 'Question'),
        questionType: str(r, 'QuestionType', 'Type') || 'MultipleChoice',
        options: str(r, 'Options'),
        correctAnswer: str(r, 'CorrectAnswer', 'Correct Answer'),
        points: num(r, 1, 'Points'),
        explanation: str(r, 'Explanation'),
        orderIndex: num(r, i + 1, 'OrderIndex', 'Order'),
      })),

      assessmentSettings: readSheet(['Assessment Settings', 'AssessmentSettings']).map((r, i) => ({
        rowNumber: i + 2,
        checkpointCode: str(r, 'CheckpointCode', 'Checkpoint ID'),
        passingPercentage: num(r, 90, 'PassingPercentage'),
        timeLimitMinutes: num(r, 15, 'TimeLimitMinutes'),
        maxAttempts: num(r, 0, 'MaxAttempts'),
        shuffleQuestions: bool(r, false, 'ShuffleQuestions'),
      })),

      rewards: readSheet(['Rewards']).map((r, i) => ({
        rowNumber: i + 2,
        checkpointCode: str(r, 'CheckpointCode', 'Checkpoint ID'),
        rewardCash: num(r, 100, 'RewardCash'),
        earlyBonusCash: num(r, 100, 'EarlyBonusCash'),
        latePenaltyCash: num(r, 50, 'LatePenaltyCash'),
      })),

      characters: readSheet(['Characters']).map((r, i) => ({
        rowNumber: i + 2,
        characterCode: str(r, 'CharacterCode'),
        name: str(r, 'Name'),
        title: str(r, 'Title'),
        description: str(r, 'Description'),
        avatarStyle: str(r, 'AvatarStyle') || 'adventurer',
        primaryColor: str(r, 'PrimaryColor') || '#3b82f6',
        secondaryColor: str(r, 'SecondaryColor') || '#f59e0b',
        defaultCostume: str(r, 'DefaultCostume') || 'COST-CYBER-JACKET',
        defaultHairstyle: str(r, 'DefaultHairstyle') || 'HAIR-SPIKY-AZURE',
        price: num(r, 0, 'Price'),
        isUnlockedByDefault: bool(r, false, 'IsUnlockedByDefault'),
      })),

      inventory: readSheet(['Inventory']).map((r, i) => ({
        rowNumber: i + 2,
        itemCode: str(r, 'ItemCode'),
        category: str(r, 'Category') || 'Costume',
        purchasePrice: num(r, 0, 'PurchasePrice'),
        isEquipped: bool(r, false, 'IsEquipped'),
      })),

      shopItems: readSheet(['Shop Items', 'ShopItems']).map((r, i) => ({
        rowNumber: i + 2,
        itemCode: str(r, 'ItemCode'),
        name: str(r, 'Name'),
        category: str(r, 'Category') || 'Costume',
        description: str(r, 'Description'),
        price: num(r, 100, 'Price'),
        rarity: str(r, 'Rarity') || 'Common',
        previewAsset: str(r, 'PreviewAsset') || '🎁',
        accentColor: str(r, 'AccentColor') || '#8b5cf6',
        isDefaultUnlocked: bool(r, false, 'IsDefaultUnlocked'),
      })),

      themes: readSheet(['Themes']).map((r, i) => ({
        rowNumber: i + 2,
        themeCode: str(r, 'ThemeCode'),
        name: str(r, 'Name'),
        description: str(r, 'Description'),
        primaryColor: str(r, 'PrimaryColor') || '#7c3aed',
        secondaryColor: str(r, 'SecondaryColor') || '#2563eb',
        accentColor: str(r, 'AccentColor') || '#f59e0b',
        backgroundStyle: str(r, 'BackgroundStyle') || 'kingdom',
        mapStyle: str(r, 'MapStyle') || 'fantasy-valley',
        price: num(r, 0, 'Price'),
        isUnlockedByDefault: bool(r, false, 'IsUnlockedByDefault'),
      })),

      userSettings: readSheet(['User Settings', 'UserSettings']).map((r, i) => ({
        rowNumber: i + 2,
        displayName: str(r, 'DisplayName') || 'Quest Hero',
        initialCurrency: num(r, 500, 'InitialCurrency'),
        defaultPassPercentage: num(r, 90, 'DefaultPassPercentage'),
        defaultTimeLimitMinutes: num(r, 15, 'DefaultTimeLimitMinutes'),
        defaultRewardCash: num(r, 100, 'DefaultRewardCash'),
        earlyBonusMultiplier: num(r, 2.0, 'EarlyBonusMultiplier'),
        defaultLatePenaltyCash: num(r, 50, 'DefaultLatePenaltyCash'),
        activeThemeCode: str(r, 'ActiveThemeCode') || 'THEME-KINGDOM',
        selectedCharacterCode: str(r, 'SelectedCharacterCode') || 'CHAR-HERO',
        soundEnabled: bool(r, true, 'SoundEnabled'),
        animationsEnabled: bool(r, true, 'AnimationsEnabled'),
      })),
    };
  }

  async exportWorkbookToExcel(data: GoalQuestExcelWorkbook, fileName?: string): Promise<void> {
    const XLSX = await this.loadXlsx();
    const wb = XLSX.utils.book_new();

    const addSheet = (name: string, rows: Record<string, unknown>[], headers: string[]) => {
      const ws =
        rows.length > 0
          ? XLSX.utils.json_to_sheet(rows, { header: headers })
          : XLSX.utils.aoa_to_sheet([headers]);
      ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));
      XLSX.utils.book_append_sheet(wb, ws, name);
    };

    addSheet(
      'Goals',
      data.goals.map((g) => ({
        GoalCode: g.goalCode,
        Title: g.title,
        Description: g.description,
        Category: g.category,
        Priority: g.priority,
        TargetDate: g.targetDate,
        Status: g.status,
        ThemeCode: g.themeCode,
        BackgroundImageUrl:
          g.backgroundImageUrl && g.backgroundImageUrl.length <= 32000 ? g.backgroundImageUrl : '',
      })),
      [
        'GoalCode',
        'Title',
        'Description',
        'Category',
        'Priority',
        'TargetDate',
        'Status',
        'ThemeCode',
        'BackgroundImageUrl',
      ],
    );

    addSheet(
      'Checkpoints',
      data.checkpoints.map((c) => ({
        CheckpointCode: c.checkpointCode,
        GoalCode: c.goalCode,
        SequenceOrder: c.sequenceOrder,
        Title: c.title,
        Description: c.description,
        DueDate: c.dueDate,
        IntervalValue: c.intervalValue,
        IntervalUnit: c.intervalUnit,
        RewardCash: c.rewardCash,
        EarlyBonusCash: c.earlyBonusCash,
        LatePenaltyCash: c.latePenaltyCash,
        PassingPercentage: c.passingPercentage,
        TimeLimitMinutes: c.timeLimitMinutes,
        Status: c.status,
      })),
      [
        'CheckpointCode',
        'GoalCode',
        'SequenceOrder',
        'Title',
        'Description',
        'DueDate',
        'IntervalValue',
        'IntervalUnit',
        'RewardCash',
        'EarlyBonusCash',
        'LatePenaltyCash',
        'PassingPercentage',
        'TimeLimitMinutes',
        'Status',
      ],
    );

    addSheet(
      'Assessment Questions',
      data.assessmentQuestions.map((q) => ({
        QuestionCode: q.questionCode,
        CheckpointCode: q.checkpointCode,
        QuestionText: q.questionText,
        QuestionType: q.questionType,
        Options: q.options,
        CorrectAnswer: q.correctAnswer,
        Points: q.points,
        Explanation: q.explanation,
        OrderIndex: q.orderIndex,
      })),
      [
        'QuestionCode',
        'CheckpointCode',
        'QuestionText',
        'QuestionType',
        'Options',
        'CorrectAnswer',
        'Points',
        'Explanation',
        'OrderIndex',
      ],
    );

    addSheet(
      'Assessment Settings',
      data.assessmentSettings.map((a) => ({
        CheckpointCode: a.checkpointCode,
        PassingPercentage: a.passingPercentage,
        TimeLimitMinutes: a.timeLimitMinutes,
        MaxAttempts: a.maxAttempts,
        ShuffleQuestions: a.shuffleQuestions,
      })),
      ['CheckpointCode', 'PassingPercentage', 'TimeLimitMinutes', 'MaxAttempts', 'ShuffleQuestions'],
    );

    addSheet(
      'Rewards',
      data.rewards.map((r) => ({
        CheckpointCode: r.checkpointCode,
        RewardCash: r.rewardCash,
        EarlyBonusCash: r.earlyBonusCash,
        LatePenaltyCash: r.latePenaltyCash,
      })),
      ['CheckpointCode', 'RewardCash', 'EarlyBonusCash', 'LatePenaltyCash'],
    );

    addSheet(
      'Characters',
      data.characters.map((c) => ({
        CharacterCode: c.characterCode,
        Name: c.name,
        Title: c.title,
        Description: c.description,
        AvatarStyle: c.avatarStyle,
        PrimaryColor: c.primaryColor,
        SecondaryColor: c.secondaryColor,
        DefaultCostume: c.defaultCostume,
        DefaultHairstyle: c.defaultHairstyle,
        Price: c.price,
        IsUnlockedByDefault: c.isUnlockedByDefault,
      })),
      [
        'CharacterCode',
        'Name',
        'Title',
        'Description',
        'AvatarStyle',
        'PrimaryColor',
        'SecondaryColor',
        'DefaultCostume',
        'DefaultHairstyle',
        'Price',
        'IsUnlockedByDefault',
      ],
    );

    addSheet(
      'Inventory',
      data.inventory.map((i) => ({
        ItemCode: i.itemCode,
        Category: i.category,
        PurchasePrice: i.purchasePrice,
        IsEquipped: i.isEquipped,
      })),
      ['ItemCode', 'Category', 'PurchasePrice', 'IsEquipped'],
    );

    addSheet(
      'Shop Items',
      data.shopItems.map((s) => ({
        ItemCode: s.itemCode,
        Name: s.name,
        Category: s.category,
        Description: s.description,
        Price: s.price,
        Rarity: s.rarity,
        PreviewAsset: s.previewAsset,
        AccentColor: s.accentColor,
        IsDefaultUnlocked: s.isDefaultUnlocked,
      })),
      [
        'ItemCode',
        'Name',
        'Category',
        'Description',
        'Price',
        'Rarity',
        'PreviewAsset',
        'AccentColor',
        'IsDefaultUnlocked',
      ],
    );

    addSheet(
      'Themes',
      data.themes.map((t) => ({
        ThemeCode: t.themeCode,
        Name: t.name,
        Description: t.description,
        PrimaryColor: t.primaryColor,
        SecondaryColor: t.secondaryColor,
        AccentColor: t.accentColor,
        BackgroundStyle: t.backgroundStyle,
        MapStyle: t.mapStyle,
        Price: t.price,
        IsUnlockedByDefault: t.isUnlockedByDefault,
      })),
      [
        'ThemeCode',
        'Name',
        'Description',
        'PrimaryColor',
        'SecondaryColor',
        'AccentColor',
        'BackgroundStyle',
        'MapStyle',
        'Price',
        'IsUnlockedByDefault',
      ],
    );

    addSheet(
      'User Settings',
      data.userSettings.map((u) => ({
        DisplayName: u.displayName,
        InitialCurrency: u.initialCurrency,
        DefaultPassPercentage: u.defaultPassPercentage,
        DefaultTimeLimitMinutes: u.defaultTimeLimitMinutes,
        DefaultRewardCash: u.defaultRewardCash,
        EarlyBonusMultiplier: u.earlyBonusMultiplier,
        DefaultLatePenaltyCash: u.defaultLatePenaltyCash,
        ActiveThemeCode: u.activeThemeCode,
        SelectedCharacterCode: u.selectedCharacterCode,
        SoundEnabled: u.soundEnabled,
        AnimationsEnabled: u.animationsEnabled,
      })),
      [
        'DisplayName',
        'InitialCurrency',
        'DefaultPassPercentage',
        'DefaultTimeLimitMinutes',
        'DefaultRewardCash',
        'EarlyBonusMultiplier',
        'DefaultLatePenaltyCash',
        'ActiveThemeCode',
        'SelectedCharacterCode',
        'SoundEnabled',
        'AnimationsEnabled',
      ],
    );

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, fileName ?? `GoalQuest_Export_${stamp}.xlsx`);
  }

  async downloadBlankTemplate(): Promise<void> {
    const empty: GoalQuestExcelWorkbook = {
      goals: [],
      checkpoints: [],
      assessmentQuestions: [],
      assessmentSettings: [],
      rewards: [],
      characters: [],
      inventory: [],
      shopItems: [],
      themes: [],
      userSettings: [],
    };
    await this.exportWorkbookToExcel(empty, 'GoalQuest_Blank_Template.xlsx');
  }

  async downloadSampleTemplate(): Promise<void> {
    const sample: GoalQuestExcelWorkbook = {
      goals: [
        {
          rowNumber: 2,
          goalCode: 'GOAL-FS-2026',
          title: 'Master Full-Stack Cloud Architecture',
          description: 'Build production Angular 21 + .NET 10 + Azure cloud systems.',
          category: 'Career',
          priority: 'High',
          targetDate: '2026-12-31',
          status: 'InProgress',
          themeCode: 'THEME-KINGDOM',
        },
      ],
      checkpoints: [
        {
          rowNumber: 2,
          checkpointCode: 'CP-FS-01',
          goalCode: 'GOAL-FS-2026',
          sequenceOrder: 1,
          title: 'Angular Signals & Architecture',
          description: 'Master standalone components, Signals, and reactive routing.',
          dueDate: '2026-12-05',
          intervalValue: 7,
          intervalUnit: 'Days',
          rewardCash: 150,
          earlyBonusCash: 150,
          latePenaltyCash: 50,
          passingPercentage: 90,
          timeLimitMinutes: 15,
          status: 'InProgress',
        },
        {
          rowNumber: 3,
          checkpointCode: 'CP-FS-02',
          goalCode: 'GOAL-FS-2026',
          sequenceOrder: 2,
          title: '.NET 10 Web API & EF Core',
          description: 'Design clean REST APIs with EF Core 10 migrations and SQL Server.',
          dueDate: '2026-12-20',
          intervalValue: 2,
          intervalUnit: 'Weeks',
          rewardCash: 200,
          earlyBonusCash: 200,
          latePenaltyCash: 75,
          passingPercentage: 90,
          timeLimitMinutes: 20,
          status: 'Locked',
        },
      ],
      assessmentQuestions: [
        {
          rowNumber: 2,
          questionCode: 'Q-FS-01',
          checkpointCode: 'CP-FS-01',
          questionText: 'Which Angular primitive provides fine-grained reactive state?',
          questionType: 'MultipleChoice',
          options: 'Signal | NgModule | ZonePatch | PipeOnly',
          correctAnswer: 'Signal',
          points: 1,
          explanation: 'Angular Signals track fine-grained reactive state updates.',
          orderIndex: 1,
        },
        {
          rowNumber: 3,
          questionCode: 'Q-FS-02',
          checkpointCode: 'CP-FS-01',
          questionText: 'Standalone components eliminate the need for NgModules.',
          questionType: 'TrueFalse',
          options: 'True | False',
          correctAnswer: 'True',
          points: 1,
          explanation: 'Standalone components declare their own imports directly.',
          orderIndex: 2,
        },
      ],
      assessmentSettings: [
        {
          rowNumber: 2,
          checkpointCode: 'CP-FS-01',
          passingPercentage: 90,
          timeLimitMinutes: 15,
          maxAttempts: 0,
          shuffleQuestions: true,
        },
      ],
      rewards: [
        {
          rowNumber: 2,
          checkpointCode: 'CP-FS-01',
          rewardCash: 150,
          earlyBonusCash: 150,
          latePenaltyCash: 50,
        },
      ],
      characters: [
        {
          rowNumber: 2,
          characterCode: 'CHAR-CYBER-ARCH',
          name: 'Nova Architect',
          title: 'Cloud Strategist',
          description: 'Master designer of distributed quest systems.',
          avatarStyle: 'adventurer',
          primaryColor: '#06b6d4',
          secondaryColor: '#8b5cf6',
          defaultCostume: 'COST-CYBER-JACKET',
          defaultHairstyle: 'HAIR-SPIKY-AZURE',
          price: 250,
          isUnlockedByDefault: false,
        },
      ],
      inventory: [
        {
          rowNumber: 2,
          itemCode: 'COST-CYBER-JACKET',
          category: 'Costume',
          purchasePrice: 0,
          isEquipped: true,
        },
      ],
      shopItems: [
        {
          rowNumber: 2,
          itemCode: 'BADGE-CLOUD-MASTER',
          name: 'Cloud Master Emblem',
          category: 'Badge',
          description: 'Awarded to architects of resilient cloud quests.',
          price: 220,
          rarity: 'Epic',
          previewAsset: '☁️',
          accentColor: '#38bdf8',
          isDefaultUnlocked: false,
        },
      ],
      themes: [
        {
          rowNumber: 2,
          themeCode: 'THEME-AURORA',
          name: 'Aurora Borealis Ridge',
          description: 'Shimmering polar sky over crystalline checkpoints.',
          primaryColor: '#14b8a6',
          secondaryColor: '#6366f1',
          accentColor: '#f59e0b',
          backgroundStyle: 'galaxy',
          mapStyle: 'cosmic-trail',
          price: 300,
          isUnlockedByDefault: false,
        },
      ],
      userSettings: [
        {
          rowNumber: 2,
          displayName: 'Quest Hero',
          initialCurrency: 500,
          defaultPassPercentage: 90,
          defaultTimeLimitMinutes: 15,
          defaultRewardCash: 100,
          earlyBonusMultiplier: 2.0,
          defaultLatePenaltyCash: 50,
          activeThemeCode: 'THEME-KINGDOM',
          selectedCharacterCode: 'CHAR-HERO',
          soundEnabled: true,
          animationsEnabled: true,
        },
      ],
    };

    await this.exportWorkbookToExcel(sample, 'GoalQuest_Sample_Template.xlsx');
  }

  async downloadTemplateGuide(): Promise<void> {
    const XLSX = await this.loadXlsx();
    const wb = XLSX.utils.book_new();

    const guideRows = [
      {
        Sheet: 'Goals',
        RequiredColumns: 'GoalCode, Title, Priority, TargetDate, Status',
        AllowedValues: 'Priority: Low|Medium|High|Critical; Status: NotStarted|InProgress|Completed|Archived',
        Notes: 'GoalCode must be unique per user. TargetDate format: YYYY-MM-DD.',
      },
      {
        Sheet: 'Checkpoints',
        RequiredColumns: 'CheckpointCode, GoalCode, SequenceOrder, Title, DueDate, IntervalUnit, PassingPercentage, Status',
        AllowedValues: 'IntervalUnit: Minutes|Hours|Days|Weeks; Status: Locked|InProgress|Completed',
        Notes: 'GoalCode must match an existing goal or a goal in the Goals sheet.',
      },
      {
        Sheet: 'Assessment Questions',
        RequiredColumns: 'QuestionCode, CheckpointCode, QuestionText, QuestionType, CorrectAnswer',
        AllowedValues: 'QuestionType: MultipleChoice|MultipleSelect|TrueFalse|ShortAnswer',
        Notes: 'Separate multiple options or multiple correct answers with pipe ( | ).',
      },
      {
        Sheet: 'Assessment Settings',
        RequiredColumns: 'CheckpointCode, PassingPercentage, TimeLimitMinutes',
        AllowedValues: 'PassingPercentage: 1-100; TimeLimitMinutes: 1-240',
        Notes: 'Updates assessment configuration on matching checkpoints.',
      },
      {
        Sheet: 'Rewards',
        RequiredColumns: 'CheckpointCode, RewardCash, EarlyBonusCash, LatePenaltyCash',
        AllowedValues: 'All numeric values >= 0',
        Notes: 'Updates reward, early bonus, and late penalty values on matching checkpoints.',
      },
      {
        Sheet: 'Characters',
        RequiredColumns: 'CharacterCode, Name, Price',
        AllowedValues: 'Price >= 0; IsUnlockedByDefault: true|false',
        Notes: 'Bulk insert or update custom RPG characters.',
      },
      {
        Sheet: 'Inventory',
        RequiredColumns: 'ItemCode, Category, PurchasePrice',
        AllowedValues: 'IsEquipped: true|false',
        Notes: 'Tracks user-owned items.',
      },
      {
        Sheet: 'Shop Items',
        RequiredColumns: 'ItemCode, Name, Category, Price',
        AllowedValues: 'Category: Costume|Accessory|Character|Skin|Effect|Badge|Theme|Hairstyle; Rarity: Common|Rare|Epic|Legendary',
        Notes: 'Bulk manage rewards shop catalog.',
      },
      {
        Sheet: 'Themes',
        RequiredColumns: 'ThemeCode, Name, Price',
        AllowedValues: 'BackgroundStyle: kingdom|cyberpunk|galaxy|volcano',
        Notes: 'Configure custom roadmap themes and color palettes.',
      },
      {
        Sheet: 'User Settings',
        RequiredColumns: 'DefaultPassPercentage, DefaultTimeLimitMinutes, EarlyBonusMultiplier',
        AllowedValues: 'EarlyBonusMultiplier: 1.0 - 10.0',
        Notes: 'First row updates your global GoalQuest profile preferences.',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(guideRows);
    ws['!cols'] = [{ wch: 22 }, { wch: 45 }, { wch: 52 }, { wch: 52 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Template Guide');
    XLSX.writeFile(wb, 'GoalQuest_Template_Guide.xlsx');
  }

  async downloadErrorReport(errors: ExcelValidationError[]): Promise<void> {
    const XLSX = await this.loadXlsx();
    const wb = XLSX.utils.book_new();
    const rows = errors.map((e) => ({
      SheetName: e.sheetName,
      RowNumber: e.rowNumber,
      Column: e.column,
      ErrorCode: e.code,
      Message: e.message,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 55 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Validation Errors');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `GoalQuest_Import_Errors_${stamp}.xlsx`);
  }
}
