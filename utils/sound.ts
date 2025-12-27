
import { SoundType } from '../types';

// Generates satisfying UI sounds using Web Audio API
// No external files required, zero loading time, works offline.
export const playSystemSound = (type: SoundType, volume: number = 0.5) => {
    if (type === 'NONE') return;

    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const now = ctx.currentTime;
        
        // Helper to create simple oscillators
        const createOsc = (
            freq: number, 
            type: OscillatorType, 
            startTime: number, 
            duration: number, 
            vol: number = volume
        ) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, startTime);
            
            gain.gain.setValueAtTime(vol, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(startTime);
            osc.stop(startTime + duration);
            return { osc, gain };
        };

        // Configuration for different sound types
        switch (type) {
            case 'SUCCESS': // "Cash Register" / Success Ding
                const s1 = createOsc(880, 'sine', now, 0.6);
                s1.osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
                
                // Add harmonic
                const s2 = createOsc(1760, 'triangle', now, 0.6, volume * 0.3);
                break;

            case 'GLASS': // "Note" / iPhone Glass
                createOsc(1200, 'sine', now, 1.5);
                break;

            case 'POP': // "Pop" / Bubble
                const p1 = createOsc(400, 'sine', now, 0.1);
                p1.osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
                break;

            case 'ERROR': // "Bonk" / Error (Fixed to be louder and clearer)
                const e1 = ctx.createOscillator();
                const eGain = ctx.createGain();
                e1.type = 'sawtooth'; // Sawtooth cuts through better than triangle
                e1.frequency.setValueAtTime(180, now);
                e1.frequency.linearRampToValueAtTime(80, now + 0.3); // Pitch slide down
                
                eGain.gain.setValueAtTime(volume * 0.8, now); // Slightly less volume as sawtooth is loud
                eGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                
                e1.connect(eGain);
                eGain.connect(ctx.destination);
                e1.start(now);
                e1.stop(now + 0.3);
                break;

            case 'CHORD': // Soft Chord
                [440, 554.37, 659.25].forEach((f, i) => {
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
                createOsc(523.25, 'sine', now, 0.8);
                break;

            // --- NEW VARIANTS ---

            case 'BEEP': // Classic Digital Beep
                createOsc(1200, 'square', now, 0.15, volume * 0.4);
                break;

            case 'ALERT': // Double Warning Beep
                createOsc(800, 'sawtooth', now, 0.1, volume * 0.5);
                createOsc(800, 'sawtooth', now + 0.15, 0.1, volume * 0.5);
                break;

            case 'RETRO': // 8-Bit Computer Sound
                const r1 = createOsc(440, 'square', now, 0.3, volume * 0.4);
                r1.osc.frequency.linearRampToValueAtTime(220, now + 0.3); // Slide down
                break;

            case 'BELL': // Gentle Chime
                const b1 = createOsc(2000, 'sine', now, 2.0, volume);
                const b2 = createOsc(3000, 'sine', now, 2.0, volume * 0.3); // Overtone
                break;

            case 'GAMING': // Arcade Success/Coin
                const g1 = createOsc(987.77, 'square', now, 0.1, volume * 0.3); // B5
                createOsc(1318.51, 'square', now + 0.1, 0.3, volume * 0.3); // E6
                break;
        }

        // Close context after sound finishes to save resources
        setTimeout(() => {
            if(ctx.state !== 'closed') ctx.close();
        }, 2500);

    } catch (e) {
        console.error("Audio error", e);
    }
};
