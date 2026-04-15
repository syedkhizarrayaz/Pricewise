import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronRight, ShoppingBag, Clock, Loader2, X, List as ListIcon, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingList } from '../types';
import { cn } from '../lib/utils';

export function Lists() {
  const { user } = useAuth();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingList, setEditingList] = useState<ShoppingList | null>(null);
  const [newListName, setNewListName] = useState('');
  const [newListItems, setNewListItems] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, `users/${user.uid}/lists`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLists: ShoppingList[] = [];
      snapshot.forEach((doc) => {
        fetchedLists.push({ id: doc.id, ...doc.data() } as ShoppingList);
      });
      setLists(fetchedLists);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching lists:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newListName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const items = newListItems.split('\n').filter(i => i.trim());
      const listData = {
        name: newListName.trim(),
        items,
        updatedAt: Date.now(),
      };

      if (editingList) {
        await updateDoc(doc(db, `users/${user.uid}/lists`, editingList.id), listData);
      } else {
        await addDoc(collection(db, `users/${user.uid}/lists`), {
          ...listData,
          createdAt: Date.now(),
          userId: user.uid
        });
      }
      
      setNewListName('');
      setNewListItems('');
      setEditingList(null);
      setShowAddModal(false);
    } catch (error) {
      console.error("Error saving list:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditList = (e: React.MouseEvent, list: ShoppingList) => {
    e.stopPropagation();
    setEditingList(list);
    setNewListName(list.name);
    setNewListItems(list.items.join('\n'));
    setShowAddModal(true);
  };

  const handleDeleteList = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/lists`, id));
    } catch (error) {
      console.error("Error deleting list:", error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (!user) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <ShoppingBag className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Sign in to save lists</h2>
        <p className="text-muted-foreground mt-2 max-w-[240px]">
          Keep your shopping lists synced across all your devices.
        </p>
      </div>
    );
  }

  return (
    <div className="pt-safe-top p-6 pb-24 max-w-md mx-auto">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black text-foreground tracking-tighter">Your Lists</h1>
          <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] mt-2 ml-0.5">
            {lists.length} Collections
          </p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
          className="w-14 h-14 gradient-primary text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-primary/30 transition-all"
        >
          <Plus className="w-8 h-8" strokeWidth={3} />
        </motion.button>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse" />
          </div>
          <p className="text-sm font-black uppercase tracking-[0.2em] mt-6">Loading lists...</p>
        </div>
      ) : (
        <div className="space-y-5">
          {lists.map((list, idx) => (
            <motion.div
              key={list.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="modern-card p-6 flex items-center justify-between group cursor-pointer relative overflow-hidden"
              onClick={(e) => handleEditList(e, list)}
            >
              {/* Subtle background glow */}
              <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
              
              <div className="flex items-center gap-6 relative">
                <div className="w-16 h-16 gradient-primary/10 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 group-hover:rotate-3">
                  <ListIcon className="w-8 h-8 text-primary" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="font-black text-xl tracking-tight text-foreground group-hover:text-primary transition-colors">{list.name}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="px-2 py-0.5 rounded-full bg-muted text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                      {list.items.length} Items
                    </span>
                    <span className="text-muted-foreground/30 text-xs">•</span>
                    <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                      <Calendar className="w-3 h-3" />
                      {formatDate(list.updatedAt)}
                    </div>
                  </div>
                </div>
              </div>
              <button 
                onClick={(e) => handleDeleteList(e, list.id)}
                className="p-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </motion.div>
          ))}

          {lists.length === 0 && (
            <div className="py-24 text-center">
              <div className="w-28 h-28 rounded-[3rem] bg-muted/50 flex items-center justify-center mx-auto mb-8 relative">
                <ListIcon className="w-12 h-12 text-muted-foreground/20" />
                <div className="absolute inset-0 border-4 border-dashed border-muted-foreground/10 rounded-[3rem] animate-[spin_10s_linear_infinite]" />
              </div>
              <h3 className="text-foreground font-black text-2xl tracking-tight">No lists yet</h3>
              <p className="text-muted-foreground text-sm font-medium mt-3 max-w-[200px] mx-auto">Start your first collection and compare prices instantly.</p>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="bg-card w-full max-w-sm rounded-[3rem] border border-border shadow-2xl overflow-hidden relative"
            >
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
              
              <div className="p-10 relative">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-black tracking-tight">{editingList ? 'Edit List' : 'New List'}</h2>
                  <button onClick={() => { setShowAddModal(false); setEditingList(null); }} className="p-3 hover:bg-muted rounded-2xl transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleCreateList} className="space-y-8">
                  <div>
                    <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3 ml-1">
                      List Name
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="e.g. Weekly Groceries"
                      className="w-full px-6 py-5 modern-input"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3 ml-1">
                      Items (one per line)
                    </label>
                    <textarea
                      value={newListItems}
                      onChange={(e) => setNewListItems(e.target.value)}
                      placeholder="Milk&#10;Eggs&#10;Bread..."
                      className="w-full h-40 px-6 py-5 modern-input resize-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isCreating || !newListName.trim() || !newListItems.trim()}
                    className="w-full py-5 gradient-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                  >
                    {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        {editingList ? <ChevronRight className="w-5 h-5" strokeWidth={3} /> : <Plus className="w-5 h-5" strokeWidth={3} />}
                        {editingList ? 'Save Changes' : 'Create List'}
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
