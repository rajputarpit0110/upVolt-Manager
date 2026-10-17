import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Package } from 'lucide-react';
import { Product } from '../../types';

interface SearchableProductSelectProps {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
  onSelectCustom?: () => void;
  disabled?: boolean;
  className?: string;
}

export const SearchableProductSelect: React.FC<SearchableProductSelectProps> = ({
  products,
  value,
  onChange,
  placeholder = '-- Select Component / Product --',
  allowCustom = false,
  onSelectCustom,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p._id === value);
  }, [products, value]);

  // Case-insensitive substring matching across name and SKU anywhere in the string
  const filteredProducts = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return products;

    // Split query by whitespace so user can search multiple words anywhere e.g. "arduino 1243"
    const terms = query.split(/\s+/).filter(Boolean);

    return products.filter((p) => {
      const targetString = `${p.name} ${p.sku || ''} ${p.category || ''}`.toLowerCase();
      // Match if all words appear anywhere inside the string
      return terms.every((term) => targetString.includes(term));
    });
  }, [products, searchTerm]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (productId: string) => {
    onChange(productId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={`w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 flex items-center justify-between text-left transition ${
          isOpen ? 'ring-2 ring-amber-500/20 border-amber-500' : 'hover:border-slate-300'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}`}
      >
        <span className="truncate">
          {selectedProduct ? (
            <span className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-slate-900 truncate">{selectedProduct.name}</span>
              <span className="text-slate-400 font-mono text-[11px] shrink-0">({selectedProduct.sku})</span>
              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-mono font-semibold shrink-0">
                Avail: {selectedProduct.currentStock}
              </span>
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ml-1.5 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Menu with Instant Search Input */}
      {isOpen && (
        <div className="absolute z-50 left-0 top-full mt-1.5 w-full min-w-[320px] max-w-full sm:min-w-[420px] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 animate-in fade-in zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-150 bg-slate-50/95 sticky top-0 z-10 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, SKU, or keyword anywhere..."
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Results List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 text-xs scroll-smooth">
            {allowCustom && onSelectCustom && (
              <button
                type="button"
                onClick={() => {
                  onSelectCustom();
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 bg-amber-50/70 hover:bg-amber-100/70 text-amber-900 font-bold flex items-center justify-between transition border-b border-amber-200/60"
              >
                <span>✨ + Custom Product (Add New)</span>
              </button>
            )}

            {filteredProducts.length === 0 ? (
              <div className="py-6 text-center text-slate-400 space-y-1">
                <Package className="w-6 h-6 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-xs">No matching products found</p>
                {searchTerm && (
                  <p className="text-[11px] text-slate-400">
                    No results for <span className="font-semibold text-slate-600">"{searchTerm}"</span>
                  </p>
                )}
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isSelected = p._id === value;
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => handleSelect(p._id)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-amber-50/60 transition ${
                      isSelected ? 'bg-amber-50 text-amber-900 font-semibold' : 'text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>SKU: {p.sku}</span>
                        {p.category && <span>• {p.category}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          p.currentStock > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {p.currentStock} in stock
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-600 ml-auto mt-1" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
