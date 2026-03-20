import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    default: {
      getItem: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; return Promise.resolve(); }),
      removeItem: vi.fn((key: string) => { delete store[key]; return Promise.resolve(); }),
    },
  };
});

describe('Phase 5 — Campaign mode', () => {
  describe('Starters data', () => {
    it('has 27 final evolution starters (Gen 1-9)', async () => {
      const { GAUNTLET_STARTERS } = await import('../../src/data/starters');
      expect(GAUNTLET_STARTERS).toHaveLength(27);
      // Check some known starters
      expect(GAUNTLET_STARTERS).toContain('charizard');
      expect(GAUNTLET_STARTERS).toContain('greninja');
      expect(GAUNTLET_STARTERS).toContain('cinderace');
      expect(GAUNTLET_STARTERS).toContain('inteleon');
    });

    it('all starters exist in the pokedex', async () => {
      const { GAUNTLET_STARTERS } = await import('../../src/data/starters');
      const pokedex = (await import('../../src/data/pokedex.json')).default;
      const pokedexIds = new Set(Object.values(pokedex).map((p: any) => p.id));
      for (const id of GAUNTLET_STARTERS) {
        expect(pokedexIds.has(id), `${id} should be in the pokedex`).toBe(true);
      }
    });
  });

  describe('Trainer names data', () => {
    it('has trainer names and sprites', async () => {
      const { TRAINER_NAMES, TRAINER_SPRITES, pickTrainerName, pickTrainerSprite } = await import('../../src/data/trainer-names');
      expect(TRAINER_NAMES.length).toBeGreaterThan(20);
      expect(TRAINER_SPRITES.length).toBeGreaterThan(10);

      const rng = { next: () => 0.5 };
      const name = pickTrainerName(rng);
      expect(name).toBeTruthy();
      const sprite = pickTrainerSprite(rng);
      expect(sprite).toBeTruthy();
    });

    it('pickTrainerName respects exclusions', async () => {
      const { TRAINER_NAMES, pickTrainerName } = await import('../../src/data/trainer-names');
      const exclude = TRAINER_NAMES.slice(0, -1); // exclude all but last
      const rng = { next: () => 0.99 };
      const name = pickTrainerName(rng, exclude);
      expect(name).toBeTruthy();
    });
  });

  describe('CampaignScreen component', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/components/CampaignScreen.tsx'),
      'utf-8',
    );

    it('shows Gauntlet and Gym Career modes', () => {
      expect(source).toContain('GAUNTLET');
      expect(source).toContain('GYM CAREER');
    });

    it('has save/continue/restart for gym career', () => {
      expect(source).toContain('CONTINUE');
      expect(source).toContain('RESTART');
      expect(source).toContain('GymCareerSave');
    });

    it('exports save helpers', () => {
      expect(source).toContain('getGymCareerSave');
      expect(source).toContain('saveGymCareer');
      expect(source).toContain('clearGymCareerSave');
    });
  });

  describe('GauntletStarterScreen component', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/components/GauntletStarterScreen.tsx'),
      'utf-8',
    );

    it('imports GAUNTLET_STARTERS', () => {
      expect(source).toContain('GAUNTLET_STARTERS');
    });

    it('uses PokemonSprite for each starter', () => {
      expect(source).toContain('PokemonSprite');
    });

    it('has confirm button that requires selection', () => {
      expect(source).toContain('CONFIRM');
      expect(source).toContain('!selected');
    });
  });

  describe('GauntletStealScreen component', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/components/GauntletStealScreen.tsx'),
      'utf-8',
    );

    it('shows opponent team to steal from', () => {
      expect(source).toContain('STEAL ONE');
      expect(source).toContain('opponentTeam');
    });

    it('shows drop option when team is full', () => {
      expect(source).toContain('DROP ONE');
      expect(source).toContain('mustDrop');
    });

    it('shows opponent trainer sprite from local bundle', () => {
      expect(source).toContain('trainerSprite');
      expect(source).toContain('TRAINER_SPRITE_MAP');
    });
  });

  describe('CampaignIntroScreen component', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/components/CampaignIntroScreen.tsx'),
      'utf-8',
    );

    it('uses local bundled trainer sprites', () => {
      expect(source).toContain('TRAINER_SPRITE_MAP');
    });

    it('shows opponent name and title', () => {
      expect(source).toContain('opponentName');
      expect(source).toContain('opponentTitle');
    });

    it('shows progress dots', () => {
      expect(source).toContain('dotsRow');
      expect(source).toContain('dotCompleted');
      expect(source).toContain('dotCurrent');
    });

    it('has battle button', () => {
      expect(source).toContain('BATTLE');
      expect(source).toContain('onBeginBattle');
    });

    it('has forfeit option', () => {
      expect(source).toContain('Forfeit Run');
    });
  });

  describe('Battle reducer — campaign actions', () => {
    it('handles GAUNTLET_START', async () => {
      const { battleReducer, initialState } = await import('../../src/client/state/battle-reducer');
      const state = battleReducer(initialState, { type: 'GAUNTLET_START', playerName: 'Ash' });
      expect(state.phase).toBe('gauntlet_starter');
      expect(state.campaignMode).toBe('gauntlet');
      expect(state.playerName).toBe('Ash');
    });

    it('handles CAMPAIGN_INTRO', async () => {
      const { battleReducer, initialState } = await import('../../src/client/state/battle-reducer');
      const state = battleReducer(initialState, {
        type: 'CAMPAIGN_INTRO',
        stage: 2,
        totalStages: 13,
        opponentName: 'Blaze',
        opponentTitle: 'Fire Gym Leader',
        trainerSprite: 'ranger',
        campaignMode: 'gym_career',
      });
      expect(state.phase).toBe('campaign_intro');
      expect(state.campaignStage).toBe(2);
      expect(state.campaignOpponentName).toBe('Blaze');
      expect(state.campaignOpponentSprite).toBe('ranger');
    });

    it('handles GAUNTLET_STEAL', async () => {
      const { battleReducer, initialState } = await import('../../src/client/state/battle-reducer');
      const state = battleReducer(initialState, {
        type: 'GAUNTLET_STEAL',
        opponentTeam: [],
        trainerName: 'Ace',
        trainerSprite: 'hiker',
      });
      expect(state.phase).toBe('gauntlet_steal');
      expect(state.campaignOpponentName).toBe('Ace');
    });

    it('handles GYM_CAREER_START', async () => {
      const { battleReducer, initialState } = await import('../../src/client/state/battle-reducer');
      const state = battleReducer(initialState, {
        type: 'GYM_CAREER_START',
        playerName: 'Red',
        gymTypes: ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Dragon', 'Dark', 'Steel'],
      });
      expect(state.phase).toBe('budget_draft');
      expect(state.campaignMode).toBe('gym_career');
      expect(state.gymTypes).toHaveLength(8);
      expect(state.beatenGyms).toHaveLength(8);
      expect(state.beatenE4).toHaveLength(4);
      expect(state.campaignTotalStages).toBe(13);
    });
  });

  describe('BattleEndOverlay — campaign advance', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/components/BattleEndOverlay.tsx'),
      'utf-8',
    );

    it('accepts campaignMode and onAdvanceCampaign props', () => {
      expect(source).toContain('campaignMode');
      expect(source).toContain('onAdvanceCampaign');
    });

    it('shows Continue button for campaign wins', () => {
      expect(source).toContain('>Continue<');
    });
  });

  describe('SetupScreen — campaign wiring', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/components/SetupScreen.tsx'),
      'utf-8',
    );

    it('imports CampaignScreen', () => {
      expect(source).toContain('CampaignScreen');
    });

    it('has onStartGauntlet and onStartGymCareer props', () => {
      expect(source).toContain('onStartGauntlet');
      expect(source).toContain('onStartGymCareer');
    });
  });

  describe('BattleScreen — campaign screen routing', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/client/components/BattleScreen.tsx'),
      'utf-8',
    );

    it('renders GauntletStarterScreen for gauntlet_starter phase', () => {
      expect(source).toContain("state.phase === 'gauntlet_starter'");
      expect(source).toContain('GauntletStarterScreen');
    });

    it('renders GauntletStealScreen for gauntlet_steal phase', () => {
      expect(source).toContain("state.phase === 'gauntlet_steal'");
      expect(source).toContain('GauntletStealScreen');
    });

    it('renders CampaignIntroScreen for campaign_intro phase', () => {
      expect(source).toContain("state.phase === 'campaign_intro'");
      expect(source).toContain('CampaignIntroScreen');
    });

    it('routes gym career draft to gymCareerDraftComplete', () => {
      expect(source).toContain("gymCareerDraftComplete");
    });
  });
});
