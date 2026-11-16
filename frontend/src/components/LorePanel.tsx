/**
 * frontend/src/components/LorePanel.tsx
 * Lore management tab: characters, traits, and items discovered or registered.
 * Supports manual entity CRUD with soft glass cards and writer typography.
 */

import React, { useState } from "react";
import { User, Sparkles, Package, BookOpen, Plus, Trash2, X } from "lucide-react";
import { useStoryStore } from "../store/useStoryStore";

export const LorePanel: React.FC = () => {
  const { currentProject, addCharacter, deleteCharacter, addItem, deleteItem } = useStoryStore();
  const lore = currentProject?.lore;

  const characters = lore?.characters || [];
  const items = lore?.items || [];

  const [isAddingChar, setIsAddingChar] = useState(false);
  const [charName, setCharName] = useState("");
  const [charAliases, setCharAliases] = useState("");
  const [charDesc, setCharDesc] = useState("");

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemAliases, setItemAliases] = useState("");
  const [itemDesc, setItemDesc] = useState("");

  const handleCharSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!charName.trim()) return;
    const aliases = charAliases ? charAliases.split(",").map((s) => s.trim()).filter(Boolean) : [];
    await addCharacter(charName.trim(), aliases, {}, charDesc.trim());
    setCharName("");
    setCharAliases("");
    setCharDesc("");
    setIsAddingChar(false);
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    const aliases = itemAliases ? itemAliases.split(",").map((s) => s.trim()).filter(Boolean) : [];
    await addItem(itemName.trim(), aliases, itemDesc.trim());
    setItemName("");
    setItemAliases("");
    setItemDesc("");
    setIsAddingItem(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 select-none bg-transparent font-serif">
      {/* Characters Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-serif italic text-muted">
            <User className="w-3.5 h-3.5 text-accent" />
            <span>Characters ({characters.length})</span>
          </div>
          <button
            onClick={() => setIsAddingChar(true)}
            className="flex items-center gap-1 text-xs glass-control hover:bg-white/90 text-muted hover:text-ink px-2.5 py-1 rounded-control transition-all shadow-sm"
          >
            <Plus className="w-3 h-3 text-accent" /> Add character
          </button>
        </div>

        {/* Add Character Modal / Form */}
        {isAddingChar && (
          <form onSubmit={handleCharSubmit} className="glass-card p-4 rounded-card mb-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">New character</span>
              <button type="button" onClick={() => setIsAddingChar(false)} className="text-muted hover:text-ink">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Character name (e.g. Elena Vance)"
              value={charName}
              onChange={(e) => setCharName(e.target.value)}
              className="w-full text-xs font-serif bg-white/90 border border-white/90 text-ink rounded-control px-2.5 py-1.5 outline-none focus:border-accent"
              autoFocus
            />
            <input
              type="text"
              placeholder="Aliases (comma separated, e.g. Elena, Agent Vance)"
              value={charAliases}
              onChange={(e) => setCharAliases(e.target.value)}
              className="w-full text-xs font-serif bg-white/90 border border-white/90 text-ink rounded-control px-2.5 py-1.5 outline-none focus:border-accent"
            />
            <textarea
              placeholder="Description / Background"
              value={charDesc}
              onChange={(e) => setCharDesc(e.target.value)}
              className="w-full text-xs font-serif bg-white/90 border border-white/90 text-ink rounded-control px-2.5 py-1.5 outline-none focus:border-accent h-16 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingChar(false)}
                className="px-3 py-1 text-xs text-muted hover:text-ink font-serif"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-accent hover:bg-accent-hover text-white rounded-control text-xs font-serif transition-colors"
              >
                Save character
              </button>
            </div>
          </form>
        )}

        {characters.length === 0 ? (
          <div className="text-xs font-serif italic text-muted border border-dashed border-white/80 rounded-card p-4 text-center glass-control">
            No characters registered yet. Add characters manually or let the linter auto-discover them.
          </div>
        ) : (
          <div className="space-y-2">
            {characters.map((char) => (
              <div
                key={char.id}
                className="group glass-card rounded-card p-3.5 hover:bg-white/80 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-ink flex items-center gap-1.5">
                      {char.name}
                      {char.aliases.length > 0 && (
                        <span className="text-xs text-muted font-normal italic">
                          (aka {char.aliases.join(", ")})
                        </span>
                      )}
                    </h4>
                    {char.description && (
                      <p className="text-xs text-muted mt-1 leading-relaxed">{char.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-serif italic bg-accent/10 text-accent px-2 py-0.5 rounded-control border border-accent/20 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      Entity
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`Delete character "${char.name}"?`)) {
                          deleteCharacter(char.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-conflict transition-opacity"
                      title="Delete character"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Character Traits */}
                {Object.keys(char.traits || {}).length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {Object.entries(char.traits).map(([trait, val]) => (
                      <span
                        key={trait}
                        className={`text-xs px-2 py-0.5 rounded-control font-serif italic ${
                          val === true
                            ? "bg-ok/10 text-ok border border-ok/30"
                            : "bg-white/60 text-muted border border-white/80"
                        }`}
                      >
                        {trait}: {String(val)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Items Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-serif italic text-muted">
            <Package className="w-3.5 h-3.5 text-[#c9a86a]" />
            <span>Items & possessions ({items.length})</span>
          </div>
          <button
            onClick={() => setIsAddingItem(true)}
            className="flex items-center gap-1 text-xs glass-control hover:bg-white/90 text-muted hover:text-ink px-2.5 py-1 rounded-control transition-all shadow-sm"
          >
            <Plus className="w-3 h-3 text-[#c9a86a]" /> Add item
          </button>
        </div>

        {/* Add Item Modal / Form */}
        {isAddingItem && (
          <form onSubmit={handleItemSubmit} className="glass-card p-4 rounded-card mb-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">New item / prop</span>
              <button type="button" onClick={() => setIsAddingItem(false)} className="text-muted hover:text-ink">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Item name (e.g. Master Key)"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full text-xs font-serif bg-white/90 border border-white/90 text-ink rounded-control px-2.5 py-1.5 outline-none focus:border-accent"
              autoFocus
            />
            <input
              type="text"
              placeholder="Aliases (comma separated)"
              value={itemAliases}
              onChange={(e) => setItemAliases(e.target.value)}
              className="w-full text-xs font-serif bg-white/90 border border-white/90 text-ink rounded-control px-2.5 py-1.5 outline-none focus:border-accent"
            />
            <textarea
              placeholder="Description / Significance"
              value={itemDesc}
              onChange={(e) => setItemDesc(e.target.value)}
              className="w-full text-xs font-serif bg-white/90 border border-white/90 text-ink rounded-control px-2.5 py-1.5 outline-none focus:border-accent h-16 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingItem(false)}
                className="px-3 py-1 text-xs text-muted hover:text-ink font-serif"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-[#c9822b] hover:bg-[#b07024] text-white rounded-control text-xs font-serif transition-colors"
              >
                Save item
              </button>
            </div>
          </form>
        )}

        {items.length === 0 ? (
          <div className="text-xs font-serif italic text-muted border border-dashed border-white/80 rounded-card p-4 text-center glass-control">
            No items registered yet. Items mentioned in scenes will appear here.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="group glass-card rounded-card p-3.5 hover:bg-white/80 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-ink flex items-center gap-1.5">
                      {item.name}
                      {item.aliases.length > 0 && (
                        <span className="text-xs text-muted font-normal italic">
                          (aka {item.aliases.join(", ")})
                        </span>
                      )}
                    </h4>
                    {item.description && (
                      <p className="text-xs text-muted mt-1 leading-relaxed">{item.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-serif italic bg-[#f3e8cf] text-[#78541c] px-2 py-0.5 rounded-control border border-[#c9a86a]">
                      Prop / Relic
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`Delete item "${item.name}"?`)) {
                          deleteItem(item.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-conflict transition-opacity"
                      title="Delete item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lore Rules Info */}
      <div className="border-t border-white/80 pt-4">
        <div className="flex items-center gap-2 mb-2 text-sm font-serif italic text-muted">
          <BookOpen className="w-3.5 h-3.5 text-ok" />
          <span>Invariant continuity rules</span>
        </div>
        <p className="text-xs font-serif italic text-muted leading-relaxed">
          Physical limits (heavy use of damaged limbs), possession lifecycles (pawned or transferred items),
          and character life states are verified deterministically across all scenes.
        </p>
      </div>
    </div>
  );
};
