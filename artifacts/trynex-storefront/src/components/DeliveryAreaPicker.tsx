import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronRight, ChevronLeft, Search, MapPin, ChevronDown, X, LocateFixed, Loader2 } from "lucide-react";
import { BD_DIVISIONS, BD_UPAZILAS, getDivisionForDistrict, getPostCode } from "@/data/bd-addresses";
import { motion, AnimatePresence } from "framer-motion";

interface DeliveryAreaPickerProps {
  selectedDistrict: string;
  selectedUpazila: string;
  onSelect: (district: string, upazila: string, division: string, postCode: string) => void;
  onGPSDetect: () => void;
  gpsLoading: boolean;
  error?: string;
}

type Level = "division" | "district" | "upazila";

export function DeliveryAreaPicker({
  selectedDistrict,
  selectedUpazila,
  onSelect,
  onGPSDetect,
  gpsLoading,
  error,
}: DeliveryAreaPickerProps) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<Level>("division");
  const [activeDivision, setActiveDivision] = useState("");
  const [activeDistrict, setActiveDistrict] = useState("");
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      setTimeout(() => searchRef.current?.focus(), 100);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    setSearch("");
  }, [level, activeDivision, activeDistrict]);

  const divisions = Object.keys(BD_DIVISIONS);

  const displayText = useMemo(() => {
    if (selectedDistrict && selectedUpazila) {
      const div = getDivisionForDistrict(selectedDistrict);
      return `${selectedUpazila}, ${selectedDistrict}`;
    }
    if (selectedDistrict) {
      return selectedDistrict;
    }
    return "";
  }, [selectedDistrict, selectedUpazila]);

  const filteredDivisions = useMemo(() => {
    if (!search) return divisions;
    const q = search.toLowerCase();
    return divisions.filter(d => d.toLowerCase().includes(q));
  }, [search, divisions]);

  const currentDistricts = useMemo(() => {
    const districts = BD_DIVISIONS[activeDivision] || [];
    if (!search) return districts;
    const q = search.toLowerCase();
    return districts.filter(d => d.toLowerCase().includes(q));
  }, [activeDivision, search]);

  const currentUpazilas = useMemo(() => {
    const upazilas = BD_UPAZILAS[activeDistrict] || [];
    if (!search) return upazilas;
    const q = search.toLowerCase();
    return upazilas.filter(u => u.toLowerCase().includes(q));
  }, [activeDistrict, search]);

  const handleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setLevel("division");
    setActiveDivision("");
    setActiveDistrict("");
    setSearch("");
    setOpen(true);
  };

  const handleSelectDivision = (division: string) => {
    setActiveDivision(division);
    setLevel("district");
  };

  const handleSelectDistrict = (district: string) => {
    setActiveDistrict(district);
    const upazilas = BD_UPAZILAS[district] || [];
    if (upazilas.length === 0) {
      const division = getDivisionForDistrict(district) || "";
      const pc = getPostCode(district);
      onSelect(district, "", division, pc);
      setOpen(false);
    } else {
      setLevel("upazila");
    }
  };

  const handleSelectUpazila = (upazila: string) => {
    const division = getDivisionForDistrict(activeDistrict) || "";
    const pc = getPostCode(activeDistrict, upazila);
    onSelect(activeDistrict, upazila, division, pc);
    setOpen(false);
  };

  const handleBack = () => {
    if (level === "upazila") {
      setLevel("district");
      setActiveDistrict("");
    } else if (level === "district") {
      setLevel("division");
      setActiveDivision("");
    }
  };

  const searchAllAreas = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    const results: { district: string; upazila: string; division: string }[] = [];

    for (const [division, districts] of Object.entries(BD_DIVISIONS)) {
      for (const district of districts) {
        if (district.toLowerCase().includes(q)) {
          results.push({ district, upazila: "", division });
        }
        const upazilas = BD_UPAZILAS[district] || [];
        for (const upazila of upazilas) {
          if (upazila.toLowerCase().includes(q)) {
            results.push({ district, upazila, division });
          }
        }
      }
    }
    return results.slice(0, 15);
  }, [search]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
          Delivery Area *
        </label>
        <button
          type="button"
          onClick={onGPSDetect}
          disabled={gpsLoading}
          className="flex items-center gap-1.5 text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors disabled:opacity-50"
        >
          {gpsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
          {gpsLoading ? "Detecting..." : "Auto-detect"}
        </button>
      </div>

      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-left transition-all"
        style={{
          background: 'rgba(255,255,255,0.95)',
          border: open ? '2px solid #E85D04' : '1.5px solid #e5e7eb',
          boxShadow: open ? '0 0 0 3px rgba(232,93,4,0.1)' : '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {displayText ? (
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <MapPin className="w-4 h-4 text-orange-500" />
            {displayText}
          </span>
        ) : (
          <span className="text-sm text-gray-400">Select delivery area</span>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}

      {selectedDistrict && getDivisionForDistrict(selectedDistrict) && (
        <p className="text-xs text-green-600 font-semibold mt-1.5 flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {getDivisionForDistrict(selectedDistrict)} Division
        </p>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -8, scaleY: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[60] w-full mt-2 rounded-2xl shadow-xl border border-gray-200 bg-white overflow-hidden origin-top"
            style={{ maxHeight: '380px' }}
          >
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 rounded-xl text-sm bg-gray-50 border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all"
                  placeholder={
                    level === "division" ? "Search area..." :
                    level === "district" ? `Search in ${activeDivision}...` :
                    `Search in ${activeDistrict}...`
                  }
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {level !== "division" && !search && (
              <button
                type="button"
                onClick={handleBack}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold bg-gray-50 border-b border-gray-100 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                {level === "district" ? activeDivision : activeDistrict}
              </button>
            )}

            <div className="overflow-y-auto" style={{ maxHeight: level !== "division" && !search ? '280px' : '310px' }}>
              {search && search.length >= 2 && searchAllAreas.length > 0 ? (
                searchAllAreas.map((item, i) => (
                  <button
                    key={`${item.district}-${item.upazila}-${i}`}
                    type="button"
                    onClick={() => {
                      if (item.upazila) {
                        const pc = getPostCode(item.district, item.upazila);
                        onSelect(item.district, item.upazila, item.division, pc);
                      } else {
                        const upazilas = BD_UPAZILAS[item.district] || [];
                        if (upazilas.length > 0) {
                          setActiveDivision(item.division);
                          setActiveDistrict(item.district);
                          setLevel("upazila");
                          setSearch("");
                        } else {
                          const pc = getPostCode(item.district);
                          onSelect(item.district, "", item.division, pc);
                        }
                      }
                      if (item.upazila) setOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <span className="font-semibold text-gray-800">
                      {item.upazila || item.district}
                    </span>
                    <span className="text-gray-400 text-xs ml-2">
                      {item.upazila ? `${item.district}, ${item.division}` : item.division}
                    </span>
                  </button>
                ))
              ) : search && search.length >= 2 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">No areas found</div>
              ) : level === "division" ? (
                filteredDivisions.map(division => (
                  <button
                    key={division}
                    type="button"
                    onClick={() => handleSelectDivision(division)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-sm hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-800">{division}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-500">
                        {BD_DIVISIONS[division].length}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-orange-400" />
                  </button>
                ))
              ) : level === "district" ? (
                currentDistricts.map(district => {
                  const upazilaCount = (BD_UPAZILAS[district] || []).length;
                  return (
                    <button
                      key={district}
                      type="button"
                      onClick={() => handleSelectDistrict(district)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 text-sm hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0 ${
                        selectedDistrict === district ? 'bg-orange-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`font-semibold ${selectedDistrict === district ? 'text-orange-600' : 'text-gray-800'}`}>
                          {district}
                        </span>
                        {upazilaCount > 0 && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-500">
                            {upazilaCount}
                          </span>
                        )}
                      </div>
                      {upazilaCount > 0 && <ChevronRight className="w-4 h-4 text-orange-400" />}
                    </button>
                  );
                })
              ) : (
                currentUpazilas.map(upazila => (
                  <button
                    key={upazila}
                    type="button"
                    onClick={() => handleSelectUpazila(upazila)}
                    className={`w-full text-left px-4 py-3.5 text-sm hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0 ${
                      selectedUpazila === upazila ? 'bg-orange-50 text-orange-600 font-bold' : 'text-gray-800 font-semibold'
                    }`}
                  >
                    {upazila}
                    <span className="text-gray-400 text-xs ml-2">({activeDistrict})</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
