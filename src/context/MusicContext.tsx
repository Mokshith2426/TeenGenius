import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export interface Track {
  id: string;
  title: string;
  genre: string;
  desc: string;
  url: string;
  durationLabel: string;
}

export const FOCUS_TRACKS: Track[] = [
  {
    id: 'rain_piano',
    title: 'Soft Rain & Gentle Piano',
    genre: 'Soft rain, Gentle piano',
    desc: 'Deep comforting sounds of rainfall layered with slow, meditative classical piano keys to dissolve local focus noise and study blocks.',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    durationLabel: '5:18'
  },
  {
    id: 'forest_ambience',
    title: 'Forest Ambience & Nature',
    genre: 'Forest, Nature ambiance',
    desc: 'Rustling green leaves, distant bird songs, and sub-audible alpha frequency atmosphere layers keeping you closely grounded.',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3',
    durationLabel: '7:42'
  },
  {
    id: 'ocean_waves',
    title: 'Ocean Waves & Cool Wind',
    genre: 'Ocean waves, Wind',
    desc: 'Therapeutic rolling ocean waves mixed with deep, steady summer wind blows for standard background rhythmic breath coordination.',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3',
    durationLabel: '6:30'
  },
  {
    id: 'fireplace_sleep',
    title: 'Cozy Fireplace & Brown Noise',
    genre: 'Fireplace, Brown noise',
    desc: 'Intense comforting warmth of crackling dry firewood embers coupled with deep, steady brown sound waves to absorb sudden room distractions.',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
    durationLabel: '5:58'
  }
];

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface MusicContextType {
  tracks: Track[];
  currentTrackIndex: number;
  currentTrack: Track;
  isPlaying: boolean;
  status: PlaybackStatus;
  volume: number;
  isMuted: boolean;
  error: string | null;
  currentTime: number;
  trackDuration: number;
  playTrack: (index: number) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  changeVolume: (val: number) => void;
  toggleMuted: () => void;
  seek: (seconds: number) => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [volume, setVolume] = useState<number>(0.5); // Default 50%
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [trackDuration, setTrackDuration] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrack = FOCUS_TRACKS[currentTrackIndex];

  // Keep refs synchronized to prevent stale closure scope leaks in event listeners
  const statusRef = useRef<PlaybackStatus>('idle');
  const indexRef = useRef<number>(0);
  const consecutiveErrorsRef = useRef<number>(0);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    indexRef.current = currentTrackIndex;
  }, [currentTrackIndex]);

  // Initialize and maintain a single audio element instance
  useEffect(() => {
    const audio = new Audio();
    // Do NOT set audio.crossOrigin = 'anonymous' to prevent CORS block on SoundHelix/third-party streams
    audioRef.current = audio;

    // Load saved settings if any
    const savedVol = localStorage.getItem('MUSIC_VOLUME');
    if (savedVol !== null) {
      const parsed = parseFloat(savedVol);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        setVolume(parsed);
        audio.volume = parsed;
      }
    } else {
      audio.volume = 0.5;
    }

    const savedMuted = localStorage.getItem('MUSIC_MUTED');
    if (savedMuted === 'true') {
      setIsMuted(true);
      audio.muted = true;
    }

    // Event Listeners
    const onCanPlay = () => {
      setError(null);
      consecutiveErrorsRef.current = 0; // Successfully loaded a track, clear errors list
      if (statusRef.current === 'loading') {
        setStatus('playing');
        audio.play().catch(err => {
          if (err.name !== 'AbortError') {
            console.warn('[MusicPlayer] Autoplay prevented by browser security rules:', err);
            setIsPlaying(false);
            setStatus('paused');
          }
        });
      }
    };

    const onPlaying = () => {
      setIsPlaying(true);
      setStatus('playing');
      setError(null);
    };

    const onPause = () => {
      setIsPlaying(false);
      setStatus('paused');
    };

    const onError = (e: Event) => {
      console.error('[MusicPlayer] Error during track playback/loading:', e);
      
      const failedTrackName = FOCUS_TRACKS[indexRef.current]?.title || 'Track';
      consecutiveErrorsRef.current += 1;
      
      if (consecutiveErrorsRef.current >= FOCUS_TRACKS.length) {
        setError('Network error: All tracks failed to stream. Please check your internet connection.');
        setStatus('error');
        setIsPlaying(false);
        consecutiveErrorsRef.current = 0; // reset
      } else {
        setError(`"${failedTrackName}" failed to stream. Automatically trying next channel...`);
        setStatus('loading');
        
        // Skip to next track on stream failure
        setTimeout(() => {
          setCurrentTrackIndex(prev => (prev + 1) % FOCUS_TRACKS.length);
        }, 2200);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onDurationChange = () => {
      setTrackDuration(audio.duration || 0);
    };

    const onEnded = () => {
      // Loop or go to next
      handleNext();
    };

    const handleNext = () => {
      setCurrentTrackIndex(prev => {
        const nextIdx = (prev + 1) % FOCUS_TRACKS.length;
        return nextIdx;
      });
    };

    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, []);

  // Update audio source when current track changes
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    
    const wasPlayingState = isPlaying || status === 'loading';
    setCurrentTime(0);
    setTrackDuration(0);
    setError(null);

    audio.src = currentTrack.url;
    audio.load();

    if (wasPlayingState) {
      setStatus('loading');
      audio.play().catch(err => {
        if (err.name !== 'AbortError') {
          console.warn('[MusicPlayer] Play request rejected:', err);
          setIsPlaying(false);
          setStatus('paused');
        }
      });
    } else {
      setStatus('idle');
    }
  }, [currentTrackIndex]);

  const playTrack = (index: number) => {
    if (index < 0 || index >= FOCUS_TRACKS.length) return;
    setError(null);
    if (index === currentTrackIndex) {
      togglePlay();
    } else {
      setCurrentTrackIndex(index);
      setIsPlaying(true);
      setStatus('loading');
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    setError(null);

    if (isPlaying) {
      audio.pause();
    } else {
      setStatus('loading');
      audio.play()
        .then(() => {
          setIsPlaying(true);
          setStatus('playing');
        })
        .catch(err => {
          console.warn('[MusicPlayer] Playback was interrupted or blocked:', err);
          setIsPlaying(false);
          setStatus('paused');
          setError('Browser blocked autoplay. Tap Play to unleash music.');
        });
    }
  };

  const nextTrack = () => {
    setError(null);
    setCurrentTrackIndex(prev => (prev + 1) % FOCUS_TRACKS.length);
    setIsPlaying(true);
    setStatus('loading');
  };

  const prevTrack = () => {
    setError(null);
    setCurrentTrackIndex(prev => (prev - 1 + FOCUS_TRACKS.length) % FOCUS_TRACKS.length);
    setIsPlaying(true);
    setStatus('loading');
  };

  const changeVolume = (val: number) => {
    const safeVal = Math.min(Math.max(val, 0), 1);
    setVolume(safeVal);
    localStorage.setItem('MUSIC_VOLUME', String(safeVal));
    if (audioRef.current) {
      audioRef.current.volume = safeVal;
    }
    if (safeVal > 0 && isMuted) {
      setIsMuted(false);
      localStorage.setItem('MUSIC_MUTED', 'false');
      if (audioRef.current) {
        audioRef.current.muted = false;
      }
    }
  };

  const toggleMuted = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    localStorage.setItem('MUSIC_MUTED', String(nextMuted));
    if (audioRef.current) {
      audioRef.current.muted = nextMuted;
    }
  };

  const seek = (seconds: number) => {
    if (audioRef.current && trackDuration > 0) {
      const safeTime = Math.min(Math.max(seconds, 0), trackDuration);
      audioRef.current.currentTime = safeTime;
      setCurrentTime(safeTime);
    }
  };

  return (
    <MusicContext.Provider
      value={{
        tracks: FOCUS_TRACKS,
        currentTrackIndex,
        currentTrack,
        isPlaying,
        status,
        volume,
        isMuted,
        error,
        currentTime,
        trackDuration,
        playTrack,
        togglePlay,
        nextTrack,
        prevTrack,
        changeVolume,
        toggleMuted,
        seek
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
}
