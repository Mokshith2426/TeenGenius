import { useState } from 'react';
import { motion } from 'motion/react';
import { Video, CheckCircle2, Clock, ArrowRight, Loader2, Play, ExternalLink, BookOpen } from 'lucide-react';
import { safeFetch } from '../../lib/api';

interface Video {
  id: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
  url: string;
  description: string;
}

export default function LearnWithVideos() {
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setVideos([]);

    try {
      const response = await safeFetch('/api/ai/learn-with-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subject: subject,
          topic: topic || ''
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get video recommendations');
      }

      const data = await response.json();
      
      // Generate placeholder thumbnails if not provided
      const videosWithThumbnails = (data.videos || []).map((video: any, index: number) => ({
        ...video,
        id: video.id || `video-${index}`,
        thumbnail: video.thumbnail || `https://i.ytimg.com/vi/placeholder${index}/mqdefault.jpg`,
        url: video.url || `https://www.youtube.com/results?search_query=${encodeURIComponent(video.title + ' ' + subject)}`
      }));
      
      setVideos(videosWithThumbnails);
    } catch (err: any) {
      setError(err.message || 'Failed to get video recommendations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getDurationColor = (duration: string) => {
    const parts = duration.split(':').map(Number);
    const totalMinutes = parts.length === 2 ? parts[0] : parts[0] * 60 + parts[1];
    
    if (totalMinutes <= 10) return 'text-emerald-600 dark:text-emerald-400';
    if (totalMinutes <= 20) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <span className="text-blue-600 dark:text-blue-400">Exam Lab</span>
        <ArrowRight size={12} />
        <span className="text-zinc-900 dark:text-white">Learn with Videos</span>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-fuchsia-50 dark:bg-fuchsia-950/30 rounded-full border border-fuchsia-200/50 dark:border-fuchsia-850">
          <Video size={13} className="text-fuchsia-600 dark:text-fuchsia-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-fuchsia-700 dark:text-fuchsia-400">
            Video Learning
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
          Learn with <span className="bg-gradient-to-r from-fuchsia-600 to-pink-500 bg-clip-text text-transparent">Videos</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-xl">
          Curated educational YouTube videos recommended based on your weak areas and topics
        </p>
      </div>

      {/* Input Form */}
      {!videos.length && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Mathematics, Physics, Chemistry"
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
                  Topic (Optional)
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Quadratic Equations, Newton's Laws"
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white font-black uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-fuchsia-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Finding Videos...
                </>
              ) : (
                <>
                  <Video size={18} />
                  Get Video Recommendations
                </>
              )}
            </button>
          </form>
        </motion.div>
      )}

      {/* Video Recommendations */}
      {videos.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
              Recommended Videos for {subject}{topic ? ` - ${topic}` : ''}
            </h2>
            <button
              onClick={() => {
                setVideos([]);
                setSubject('');
                setTopic('');
              }}
              className="text-xs font-bold text-fuchsia-600 dark:text-fuchsia-400 hover:text-fuchsia-700 dark:hover:text-fuchsia-300"
            >
              Search Again
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {videos.map((video, index) => (
              <motion.a
                key={video.id}
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden hover:border-fuchsia-300 dark:hover:border-fuchsia-700 hover:shadow-lg hover:shadow-fuchsia-500/10 transition-all"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/placeholder${index}/mqdefault.jpg`;
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                    <div className="w-16 h-16 bg-fuchsia-600/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play size={24} className="text-white ml-1" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs font-bold text-white">
                    {video.duration}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-2 line-clamp-2 group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-400 transition-colors">
                    {video.title}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                    {video.channel}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-3">
                    {video.description}
                  </p>
                  <div className="flex items-center gap-1 text-xs font-medium text-fuchsia-600 dark:text-fuchsia-400">
                    <ExternalLink size={12} />
                    <span>Watch on YouTube</span>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>

          {/* Tips */}
          <div className="bg-gradient-to-r from-fuchsia-50 to-pink-50 dark:from-fuchsia-950/20 dark:to-pink-950/20 border border-fuchsia-200 dark:border-fuchsia-800 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-fuchsia-100 dark:bg-fuchsia-900/30 rounded-xl flex items-center justify-center shrink-0">
                <BookOpen size={24} className="text-fuchsia-600 dark:text-fuchsia-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-fuchsia-900 dark:text-fuchsia-100 uppercase tracking-wider mb-2">
                  Learning Tips
                </h3>
                <ul className="space-y-1 text-xs text-fuchsia-700 dark:text-fuchsia-300">
                  <li>• Take notes while watching to improve retention</li>
                  <li>• Pause and replay difficult sections</li>
                  <li>• Practice problems after each video</li>
                  <li>• Create a study schedule for video watching</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}