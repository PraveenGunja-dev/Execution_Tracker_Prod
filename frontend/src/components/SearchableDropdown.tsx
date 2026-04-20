
import React, { useState, useRef, useEffect } from 'react';

interface SearchableDropdownProps {
    options: string[];
    value: string;
    onChange: (value: string) => void;
    onAddNew?: (value: string) => void;
    placeholder?: string;
    className?: string;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
    options,
    value,
    onChange,
    onAddNew,
    placeholder = "Select an option...",
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Sync input value with external value prop
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setInputValue(value); // Reset to last confirmed value
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [value]);

    const filteredOptions = options.filter(option =>
        option.toLowerCase().includes(inputValue.toLowerCase())
    );

    const showAddNew = onAddNew && inputValue.trim() !== "" && !options.some(opt => opt.toLowerCase() === inputValue.toLowerCase());

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div className="relative group">
                <input
                    type="text"
                    className="w-full px-4 py-2.5 pr-10 text-sm bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-gray-100 placeholder:text-gray-400 font-medium shadow-sm hover:border-gray-300 dark:hover:border-gray-600"
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-400 group-hover:text-gray-500 transition-colors">
                    {inputValue && (
                        <>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setInputValue("");
                                    onChange("");
                                }}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors pointer-events-auto"
                                title="Clear"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
                        </>
                    )}
                    <svg className={`w-4 h-4 transition-transform duration-300 pointer-events-none ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-[110] w-full mt-2 bg-white dark:bg-[#242424] border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl max-h-64 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="overflow-y-auto flex-1 custom-scrollbar py-2">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option, index) => (
                                <div
                                    key={index}
                                    className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors
                                        ${value === option
                                            ? 'bg-[#0B74B0]/5 dark:bg-[#0B74B0]/30 text-[#0B74B0] dark:text-[#60a5fa] font-bold'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                                    onClick={() => {
                                        onChange(option);
                                        setInputValue(option);
                                        setIsOpen(false);
                                    }}
                                >
                                    <span>{option}</span>
                                    {value === option && (
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="px-5 py-6 text-center">
                                <p className="text-xs text-gray-400 font-medium italic">
                                    {inputValue ? `No matches for "${inputValue}"` : "Start typing to search..."}
                                </p>
                            </div>
                        )}

                        {showAddNew && (
                            <div
                                className="mx-2 mt-1 px-3 py-3 text-sm text-[#0B74B0] dark:text-[#60a5fa] bg-[#0B74B0]/5 dark:bg-[#0B74B0]/20 hover:bg-[#0B74B0]/10 dark:hover:bg-[#0B74B0]/40 cursor-pointer font-bold rounded-xl flex items-center gap-3 transition-all"
                                onClick={() => {
                                    onAddNew(inputValue);
                                    setIsOpen(false);
                                }}
                            >
                                <span className="bg-[#0B74B0] text-white w-5 h-5 rounded-lg flex items-center justify-center text-xs shadow-sm">+</span>
                                Add "{inputValue}"
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableDropdown;
