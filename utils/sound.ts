
import { SoundType } from '../types';

// Generates "Apple-style" satisfying UI sounds using Web Audio API
// No external files required, zero loading time, works offline.
export const playSystemSound = (type: SoundType, volume: number = 0.5) => {
    if (type === 'NONE') return;

    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        
        // Configuration for different sound types
        switch (type) {
            case 'SUCCESS': // "Cash Register" / Success Ding
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now); // A5
                osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1); // Quick slide up
                gain.gain.setValueAtTime(volume, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
                osc.start(now);
                osc.stop(now + 0.6);
                
                // Add a second harmonic for richness
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'triangle';
                osc2.frequency.setValueAtTime(1760, now);
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                gain2.gain.setValueAtTime(volume * 0.3, now);
                gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
                osc2.start(now);
                osc2.stop(now + 0.6);
                break;

            case 'GLASS': // "Note" / iPhone Glass
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, now);
                gain.gain.setValueAtTime(volume, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
                osc.start(now);
                osc.stop(now + 1.5);
                break;

            case 'POP': // "Pop" / Bubble
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
                gain.gain.setValueAtTime(volume, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;

            case 'ERROR': // "Bonk" / Error
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.linearRampToValueAtTime(100, now + 0.3);
                gain.gain.setValueAtTime(volume, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                break;

            case 'CHORD': // Soft Chord
                const freqs = [440, 554.37, 659.25]; // A Major
                freqs.forEach((f, i) => {
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    o.type = 'sine';
                    o.frequency.value = f;
                    o.connect(g);
                    g.connect(ctx.destination);
                    g.gain.setValueAtTime(0, now);
                    g.gain.linearRampToValueAtTime(volume * 0.3, now + 0.05 + (i * 0.02));
                    g.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
                    o.start(now);
                    o.stop(now + 1.5);
                });
                break;

            case 'NOTE': // Simple Notification
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, now); // C5
                gain.gain.setValueAtTime(volume, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
                osc.start(now);
                osc.stop(now + 0.8);
                break;
        }

        // Close context after sound finishes to save resources
        setTimeout(() => {
            if(ctx.state !== 'closed') ctx.close();
        }, 2000);

    } catch (e) {
        console.error("Audio error", e);
    }
};
