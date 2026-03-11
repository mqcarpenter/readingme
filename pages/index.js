import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { BookOpen, Search, List, CheckCircle, LogOut } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [books, setBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('queue'); // queue, reading, done
  const [searchQuery, setSearchQuery] = useState('');
  
  // Recommendation State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  // Add Book State
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [addBookLoading, setAddBookLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login');
      } else {
        setSession(session);
        fetchBooks(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      } else {
        setSession(session);
        fetchBooks(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function fetchBooks(userId) {
    setLoading(true);
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setBooks(data);
    }
    setLoading(false);
  }

  // Update filtered books when search, tab, or books array changes
  useEffect(() => {
    let result = books.filter(b => b.status === activeTab);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b => 
        (b.title && b.title.toLowerCase().includes(q)) || 
        (b.author && b.author.toLowerCase().includes(q))
      );
    }
    setFilteredBooks(result);
  }, [books, activeTab, searchQuery]);

  async function updateStatus(id, newStatus) {
    const originalBooks = [...books];
    setBooks(books.map(b => b.id === id ? { ...b, status: newStatus } : b));

    const { error } = await supabase
      .from('books')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('user_id', session?.user?.id);

    if (error) {
      setBooks(originalBooks);
      alert('Failed to update book status');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function handleFindSimilar(book) {
    setSelectedBook(book);
    setIsModalOpen(true);
    setRecLoading(true);
    setRecommendations([]);

    try {
      const res = await fetch(`/api/recommend?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author || '')}`);
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRecLoading(false);
    }
  }

  async function queueRecommendation(rec) {
    const { error } = await supabase.from('books').insert({
      title: rec.title,
      author: rec.author,
      isbn13: rec.isbn13,
      user_id: session.user.id,
      status: 'queue'
    });
    
    if (!error) {
      alert(`Added "${rec.title}" to your Queue!`);
      fetchBooks(session.user.id);
    } else {
      alert('Failed to add book.');
    }
  }

  if (!session) return null; // Prevent flash before redirect

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-24">
      <Head>
        <title>Antigravity Book Manager</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 text-indigo-400">
          <BookOpen className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight text-white">ReadingMe</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsAddBookModalOpen(true)} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
          >
            <span className="text-lg leading-none">+</span> Add Book
          </button>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6">
        {/* Search */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-500" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl leading-5 bg-slate-800 text-slate-300 placeholder-slate-500 focus:outline-none focus:bg-slate-700/50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            placeholder="Search your library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Book List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-700 rounded-2xl bg-slate-800/50">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-300">No books found</h3>
            <p className="text-slate-500 mt-1">
              {searchQuery ? "Try a different search term" : `Your ${activeTab} list is empty`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBooks.map((book) => (
              <div key={book.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row gap-4 shadow-sm hover:border-slate-600 transition-colors">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white truncate pr-2">{book.title}</h3>
                  <p className="text-slate-400 text-sm mt-1">{book.author}</p>
                  
                  {/* Find Similar Button positioned under the title */}
                  {(book.user_rating >= 4 || book.average_rating >= 4.0) && (
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleFindSimilar(book);
                      }}
                      className="mt-3 text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-full w-fit border border-indigo-500/20 relative z-10"
                    >
                      <Search className="w-3 h-3" /> Find Similar
                    </button>
                  )}
                </div>
                
                {/* Status Actions */}
                <div className="flex gap-2 shrink-0 border-t border-slate-700 sm:border-0 pt-3 sm:pt-0 mt-2 sm:mt-0 items-center justify-end">
                  {activeTab !== 'queue' && (
                    <button 
                      onClick={() => updateStatus(book.id, 'queue')}
                      className="px-4 py-2 text-sm font-medium text-indigo-400 hover:bg-slate-700 rounded-lg transition-colors border border-indigo-500/20"
                    >
                      Queue
                    </button>
                  )}
                  {activeTab !== 'reading' && (
                    <button 
                      onClick={() => updateStatus(book.id, 'reading')}
                      className="px-4 py-2 text-sm font-medium text-amber-500 hover:bg-slate-700 rounded-lg transition-colors border border-amber-500/20"
                    >
                      Start
                    </button>
                  )}
                  {activeTab !== 'done' && (
                    <button 
                      onClick={() => updateStatus(book.id, 'done')}
                      className="px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-slate-700 rounded-lg transition-colors border border-emerald-500/20"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 z-50 px-6 py-3 safe-area-pb">
        <div className="max-w-md mx-auto flex justify-between">
          <button 
            onClick={() => setActiveTab('queue')}
            className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'queue' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'} transition-colors`}
          >
            <List className="w-6 h-6" />
            <span className="text-[10px] font-semibold tracking-wider uppercase">Queue</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('reading')}
            className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'reading' ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'} transition-colors`}
          >
            <BookOpen className="w-6 h-6" />
            <span className="text-[10px] font-semibold tracking-wider uppercase">Reading</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('done')}
            className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'done' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'} transition-colors`}
          >
            <CheckCircle className="w-6 h-6" />
            <span className="text-[10px] font-semibold tracking-wider uppercase">Done</span>
          </button>
        </div>
      </nav>

      {/* Recommendation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
              <h2 className="text-lg font-bold text-white">Because you liked <span className="text-indigo-400">{selectedBook?.title}</span>...</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {recLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
                  <p>Analyzing library & computing rubrics...</p>
                </div>
              ) : recommendations.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No solid recommendations found.
                </div>
              ) : (
                recommendations.map((rec, i) => (
                  <div key={i} className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                    <div className="flex gap-4">
                      {rec.imageUrl && (
                        <a 
                          href={`https://www.goodreads.com/search?q=${encodeURIComponent(rec.title + ' ' + rec.author)}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="shrink-0 hover:opacity-80 transition-opacity"
                        >
                          <img src={rec.imageUrl} alt={rec.title} className="w-16 h-24 object-cover rounded-md shadow-sm border border-slate-700" />
                        </a>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <a 
                            href={`https://www.goodreads.com/search?q=${encodeURIComponent(rec.title + ' ' + rec.author)}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-semibold text-white text-base leading-tight hover:text-indigo-400 transition-colors"
                          >
                            {rec.title}
                          </a>
                          <div className="shrink-0 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-1 rounded-full border border-indigo-500/30">
                            {rec.score}/8 PTS
                          </div>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">{rec.author}</p>
                        
                        <div className="mt-2 flex flex-wrap gap-2">
                          {rec.genre && rec.genre !== 'Unknown Genre' && (
                            <span className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded-md border border-slate-700">
                              {rec.genre}
                            </span>
                          )}
                          {rec.communityRating && (
                            <span className="bg-yellow-500/10 text-yellow-500 text-xs px-2 py-1 rounded-md border border-yellow-500/20 flex items-center gap-1">
                              ★ {rec.communityRating}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/50">
                          <p className="text-xs text-slate-300 italic leading-relaxed">
                            "{rec.reason}"
                          </p>
                        </div>
                        
                        <div className="mt-3 flex justify-end">
                          <button 
                            onClick={() => queueRecommendation(rec)}
                            className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <List className="w-3.5 h-3.5" /> Add to Queue
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Book Modal */}
      {isAddBookModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-400" /> Add New Book</h2>
              <button onClick={() => setIsAddBookModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                  placeholder="e.g. Project Hail Mary"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Author</label>
                <input
                  type="text"
                  value={newBookAuthor}
                  onChange={(e) => setNewBookAuthor(e.target.value)}
                  placeholder="e.g. Andy Weir"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
              
              <div className="mt-2 flex justify-end gap-3">
                <button
                  onClick={() => setIsAddBookModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!newBookTitle.trim() || addBookLoading}
                  onClick={async () => {
                    setAddBookLoading(true);
                    await supabase.from('books').insert({
                      title: newBookTitle,
                      author: newBookAuthor,
                      user_id: session.user.id,
                      status: 'queue'
                    });
                    setNewBookTitle('');
                    setNewBookAuthor('');
                    setAddBookLoading(false);
                    setIsAddBookModalOpen(false);
                    fetchBooks(session.user.id);
                  }}
                  className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addBookLoading ? 'Adding...' : 'Add to Queue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile Safe Area helper */}
      <style jsx global>{`
        .safe-area-pb {
          padding-bottom: env(safe-area-inset-bottom, 12px);
        }
      `}</style>
    </div>
  );
}
