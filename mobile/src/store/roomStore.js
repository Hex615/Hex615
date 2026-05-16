import { create } from 'zustand';

const useRoomStore = create((set, get) => ({
  currentRoom: null,
  participants: [],
  comments: [],
  boostCount: 0,
  giftOverlay: null,

  setRoom: (room) => set({ currentRoom: room }),
  setParticipants: (participants) => set({ participants }),

  updateMicSlots: (slots) => set({ participants: slots }),

  addComment: (comment) =>
    set((s) => ({ comments: [...s.comments.slice(-99), comment] })),

  setBoostCount: (count) => set({ boostCount: count }),

  showGift: (gift) => {
    set({ giftOverlay: gift });
    setTimeout(() => set({ giftOverlay: null }), 3000);
  },

  leaveRoom: () => set({ currentRoom: null, participants: [], comments: [], boostCount: 0, giftOverlay: null }),
}));

export default useRoomStore;
