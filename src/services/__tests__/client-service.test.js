import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clientService } from '../client-service';

import { LOCAL_STORAGE_KEYS } from '../../constants';
import { deleteStorageValue, getStorageValue, setStorageValue } from '../../utils';

vi.mock('../../utils', () => ({
  deleteStorageValue: vi.fn(),
  getStorageValue: vi.fn(),
  setStorageValue: vi.fn(),
}));

describe('clientService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'client-uuid-1') });
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null) });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('getOrCreateClientId', () => {
    it('returns a stored client id without touching legacy storage', () => {
      getStorageValue.mockReturnValue('stored-client-id');

      expect(clientService.getOrCreateClientId()).toBe('stored-client-id');
      expect(getStorageValue).toHaveBeenCalledWith(LOCAL_STORAGE_KEYS.CLIENT_ID, null);
      expect(localStorage.getItem).not.toHaveBeenCalled();
      expect(setStorageValue).not.toHaveBeenCalled();
    });

    it('migrates a legacy raw client id when structured storage is empty', () => {
      getStorageValue.mockReturnValue(null);
      localStorage.getItem.mockReturnValue('legacy-client-id');

      expect(clientService.getOrCreateClientId()).toBe('legacy-client-id');
      expect(localStorage.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEYS.CLIENT_ID);
      expect(setStorageValue).toHaveBeenCalledWith(
        LOCAL_STORAGE_KEYS.CLIENT_ID,
        'legacy-client-id'
      );
    });

    it('creates and stores a new uuid client id when no value exists', () => {
      getStorageValue.mockReturnValue('');

      expect(clientService.getOrCreateClientId()).toBe('client-uuid-1');
      expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
      expect(setStorageValue).toHaveBeenCalledWith(LOCAL_STORAGE_KEYS.CLIENT_ID, 'client-uuid-1');
    });

    it('falls back to a generated client id when randomUUID is unavailable', () => {
      getStorageValue.mockReturnValue(null);
      vi.stubGlobal('crypto', {});
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      vi.spyOn(Date, 'now').mockReturnValue(255);

      expect(clientService.getOrCreateClientId()).toBe('client_8_ff');
      expect(setStorageValue).toHaveBeenCalledWith(LOCAL_STORAGE_KEYS.CLIENT_ID, 'client_8_ff');
    });

    it('creates a new id when legacy localStorage access fails', () => {
      getStorageValue.mockReturnValue(null);
      localStorage.getItem.mockImplementation(() => {
        throw new Error('storage blocked');
      });

      expect(clientService.getOrCreateClientId()).toBe('client-uuid-1');
      expect(setStorageValue).toHaveBeenCalledWith(LOCAL_STORAGE_KEYS.CLIENT_ID, 'client-uuid-1');
    });
  });

  describe('getDisplayName', () => {
    it('returns a stored display name', () => {
      getStorageValue.mockReturnValue('Player1');

      expect(clientService.getDisplayName()).toBe('Player1');
      expect(getStorageValue).toHaveBeenCalledWith(LOCAL_STORAGE_KEYS.DISPLAY_NAME, '');
      expect(localStorage.getItem).not.toHaveBeenCalled();
    });

    it('migrates a legacy raw display name', () => {
      getStorageValue.mockReturnValue('');
      localStorage.getItem.mockReturnValue('Player2');

      expect(clientService.getDisplayName()).toBe('Player2');
      expect(localStorage.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEYS.DISPLAY_NAME);
      expect(setStorageValue).toHaveBeenCalledWith(LOCAL_STORAGE_KEYS.DISPLAY_NAME, 'Player2');
    });

    it('returns an empty string when no display name exists', () => {
      getStorageValue.mockReturnValue(null);

      expect(clientService.getDisplayName()).toBe('');
      expect(setStorageValue).not.toHaveBeenCalled();
    });

    it('returns an empty string when legacy display name lookup fails', () => {
      getStorageValue.mockReturnValue(null);
      localStorage.getItem.mockImplementation(() => {
        throw new Error('legacy storage blocked');
      });

      expect(clientService.getDisplayName()).toBe('');
    });
  });

  describe('setDisplayName', () => {
    it('trims and stores a display name', () => {
      clientService.setDisplayName('  Player3  ');

      expect(setStorageValue).toHaveBeenCalledWith(LOCAL_STORAGE_KEYS.DISPLAY_NAME, 'Player3');
      expect(deleteStorageValue).not.toHaveBeenCalled();
    });

    it('deletes the display name for blank, null, and undefined values', () => {
      clientService.setDisplayName('   ');
      clientService.setDisplayName(null);
      clientService.setDisplayName(undefined);

      expect(deleteStorageValue).toHaveBeenCalledTimes(3);
      expect(deleteStorageValue).toHaveBeenNthCalledWith(1, LOCAL_STORAGE_KEYS.DISPLAY_NAME);
      expect(setStorageValue).not.toHaveBeenCalled();
    });
  });
});
