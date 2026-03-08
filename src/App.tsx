/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Droplets, 
  Target, 
  Utensils, 
  Calendar,
  Save,
  Edit2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types & Constants ---

interface Food {
  id: string;
  name: string;
  calories: number; // per unit/100g
  protein: number;  // per unit/100g
  unit: string;     // 'g', 'ml', 'unidade', etc.
}

interface MealItem {
  foodId: string;
  quantity: number; // in units or grams/100
}

interface Meal {
  id: string;
  name: string;
  items: MealItem[];
}

interface DayPlan {
  id: string;
  name: string;
  meals: Meal[];
  waterConsumed: number;
}

const DAYS_OF_WEEK = [
  'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'
];

const INITIAL_FOODS: Food[] = [
  { id: '1', name: 'Carne', calories: 250, protein: 26, unit: '100g' },
  { id: '2', name: 'Frango', calories: 165, protein: 31, unit: '100g' },
  { id: '3', name: 'Queijo', calories: 300, protein: 25, unit: '100g' },
  { id: '4', name: 'Ovos', calories: 70, protein: 6, unit: 'unidade' },
  { id: '5', name: 'Leite', calories: 60, protein: 3, unit: '100ml' },
  { id: '6', name: 'Iogurte', calories: 60, protein: 4, unit: '100g' },
  { id: '7', name: 'Frutas', calories: 50, protein: 0.5, unit: '100g' },
  { id: '8', name: 'Abacate', calories: 160, protein: 2, unit: '100g' },
  { id: '9', name: 'Coco', calories: 350, protein: 3, unit: '100g' },
  { id: '10', name: 'Castanhas', calories: 600, protein: 15, unit: '100g' },
  { id: '11', name: 'Morangos', calories: 32, protein: 0.7, unit: '100g' },
];

const STORAGE_KEY = 'nutriplan_data_v1';

// --- Helper Functions ---

const calculateMealMacros = (meal: Meal, foods: Food[]) => {
  return meal.items.reduce((acc, item) => {
    const food = foods.find(f => f.id === item.foodId);
    if (!food) return acc;
    return {
      calories: acc.calories + (food.calories * item.quantity),
      protein: acc.protein + (food.protein * item.quantity),
    };
  }, { calories: 0, protein: 0 });
};

const calculateDayMacros = (day: DayPlan, foods: Food[]) => {
  return day.meals.reduce((acc, meal) => {
    const macros = calculateMealMacros(meal, foods);
    return {
      calories: acc.calories + macros.calories,
      protein: acc.protein + macros.protein,
    };
  }, { calories: 0, protein: 0 });
};

// --- Main Component ---

export default function App() {
  // State
  const [goals, setGoals] = useState({ calories: 1280, protein: 128, water: 2.24 });
  const [foods, setFoods] = useState<Food[]>(INITIAL_FOODS);
  const [weeklyPlan, setWeeklyPlan] = useState<DayPlan[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({ '0': true });
  
  // UI State
  const [isAddingFood, setIsAddingFood] = useState(false);
  const [newFood, setNewFood] = useState<Partial<Food>>({ name: '', calories: 0, protein: 0, unit: '100g' });

  // Initialize data
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setGoals(parsed.goals);
      setFoods(parsed.foods);
      setWeeklyPlan(parsed.weeklyPlan);
    } else {
      generateFullWeeklyPlan(INITIAL_FOODS, { calories: 1280, protein: 128, water: 2.24 });
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (weeklyPlan.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ goals, foods, weeklyPlan }));
    }
  }, [goals, foods, weeklyPlan]);

  const generateMeal = (name: string, targetCals: number, targetProtein: number, availableFoods: Food[]): Meal => {
    // Seleciona 4 alimentos aleatórios
    const shuffled = [...availableFoods].sort(() => 0.5 - Math.random());
    const mealFoods = shuffled.slice(0, 4);
    
    // Identifica a melhor fonte de proteína entre os selecionados
    const proteinSource = [...mealFoods].sort((a, b) => (b.protein / b.calories) - (a.protein / a.calories))[0];
    const others = mealFoods.filter(f => f.id !== proteinSource.id);

    // Atribui uma quantidade base pequena para todos (0.2 unidades ou 20g)
    const items: MealItem[] = mealFoods.map(f => ({ foodId: f.id, quantity: 0.2 }));

    const getTotals = (currentItems: MealItem[]) => {
      return currentItems.reduce((acc, item) => {
        const f = mealFoods.find(food => food.id === item.foodId)!;
        return {
          calories: acc.calories + (f.calories * item.quantity),
          protein: acc.protein + (f.protein * item.quantity)
        };
      }, { calories: 0, protein: 0 });
    };

    // Ajusta a fonte de proteína para atingir a meta de proteína da refeição
    let totals = getTotals(items);
    const pIdx = items.findIndex(it => it.foodId === proteinSource.id);
    const neededProtein = targetProtein - totals.protein;
    if (neededProtein > 0) {
      items[pIdx].quantity += neededProtein / proteinSource.protein;
    }

    // Ajusta a fonte de energia (menor ratio proteína/caloria) para atingir a meta de calorias
    totals = getTotals(items);
    const energySource = others.sort((a, b) => (a.protein / a.calories) - (b.protein / b.calories))[0];
    const eIdx = items.findIndex(it => it.foodId === energySource.id);
    const neededCals = targetCals - totals.calories;
    if (neededCals > 0) {
      items[eIdx].quantity += neededCals / energySource.calories;
    }

    return {
      id: Math.random().toString(36).substr(2, 9),
      name,
      items: items.map(it => ({ ...it, quantity: Number(it.quantity.toFixed(1)) }))
    };
  };

  const generateFullWeeklyPlan = (currentFoods: Food[], currentGoals: typeof goals) => {
    const newPlan: DayPlan[] = DAYS_OF_WEEK.map((name, index) => ({
      id: index.toString(),
      name,
      waterConsumed: 0,
      meals: [
        generateMeal('Café da Manhã', currentGoals.calories / 3, currentGoals.protein / 3, currentFoods),
        generateMeal('Almoço', currentGoals.calories / 3, currentGoals.protein / 3, currentFoods),
        generateMeal('Jantar', currentGoals.calories / 3, currentGoals.protein / 3, currentFoods),
      ]
    }));
    setWeeklyPlan(newPlan);
  };

  const updateWater = (amount: number) => {
    const newPlan = [...weeklyPlan];
    newPlan[selectedDayIndex].waterConsumed += amount;
    setWeeklyPlan(newPlan);
  };

  const addCustomFood = () => {
    if (!newFood.name || newFood.calories === undefined || newFood.protein === undefined) return;
    const food: Food = {
      id: Date.now().toString(),
      name: newFood.name,
      calories: Number(newFood.calories),
      protein: Number(newFood.protein),
      unit: newFood.unit || '100g'
    };
    setFoods([...foods, food]);
    setIsAddingFood(false);
    setNewFood({ name: '', calories: 0, protein: 0, unit: '100g' });
  };

  const removeFoodFromMeal = (dayIdx: number, mealIdx: number, itemIdx: number) => {
    const newPlan = [...weeklyPlan];
    newPlan[dayIdx].meals[mealIdx].items.splice(itemIdx, 1);
    setWeeklyPlan(newPlan);
  };

  const updateItemQuantity = (dayIdx: number, mealIdx: number, itemIdx: number, newQty: number) => {
    const newPlan = [...weeklyPlan];
    newPlan[dayIdx].meals[mealIdx].items[itemIdx].quantity = Math.max(0, newQty);
    setWeeklyPlan(newPlan);
  };

  const addItemToMeal = (dayIdx: number, mealIdx: number, foodId: string) => {
    const newPlan = [...weeklyPlan];
    newPlan[dayIdx].meals[mealIdx].items.push({ foodId, quantity: 1 });
    setWeeklyPlan(newPlan);
  };

  const currentDay = weeklyPlan[selectedDayIndex];
  const dayMacros = currentDay ? calculateDayMacros(currentDay, foods) : { calories: 0, protein: 0 };

  const getProgressColor = (current: number, target: number) => {
    const ratio = current / target;
    if (ratio >= 1) return 'bg-emerald-500';
    if (ratio >= 0.8) return 'bg-orange-500';
    return 'bg-slate-400';
  };

  const getTextColor = (current: number, target: number) => {
    const ratio = current / target;
    if (ratio >= 1) return 'text-emerald-600';
    if (ratio >= 0.8) return 'text-orange-600';
    return 'text-slate-500';
  };

  if (weeklyPlan.length === 0) return <div className="flex items-center justify-center h-screen bg-slate-50">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Utensils className="text-emerald-500" />
            NutriPlan
          </h1>
          <button 
            onClick={() => generateFullWeeklyPlan(foods, goals)}
            className="text-xs font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-3 py-2 rounded-full flex items-center gap-2 hover:bg-emerald-100 transition-colors"
          >
            <RefreshCw size={14} />
            Gerar Cardápio
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        
        {/* Metas Nutricionais */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
            <Target size={16} />
            Metas Nutricionais Diárias
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Calorias (kcal)</label>
              <input 
                type="number" 
                value={goals.calories} 
                onChange={(e) => setGoals({...goals, calories: Number(e.target.value)})}
                className="w-full bg-slate-50 border-none rounded-lg px-3 py-2 font-mono text-lg focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Proteína (g)</label>
              <input 
                type="number" 
                value={goals.protein} 
                onChange={(e) => setGoals({...goals, protein: Number(e.target.value)})}
                className="w-full bg-slate-50 border-none rounded-lg px-3 py-2 font-mono text-lg focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Água (L)</label>
              <input 
                type="number" 
                step="0.01"
                value={goals.water} 
                onChange={(e) => setGoals({...goals, water: Number(e.target.value)})}
                className="w-full bg-slate-50 border-none rounded-lg px-3 py-2 font-mono text-lg focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>
        </section>

        {/* Progresso do Dia */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Calendar size={16} />
              Progresso: {currentDay.name}
            </h2>
            <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar">
              {DAYS_OF_WEEK.map((day, idx) => (
                <button
                  key={day}
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`w-8 h-8 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                    selectedDayIndex === idx 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' 
                    : 'bg-white text-slate-400 border border-slate-200'
                  }`}
                >
                  {day[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {/* Calorie Progress */}
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Calorias</span>
                <span className={`text-sm font-mono font-bold ${getTextColor(dayMacros.calories, goals.calories)}`}>
                  {Math.round(dayMacros.calories)} / {goals.calories} kcal
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (dayMacros.calories / goals.calories) * 100)}%` }}
                  className={`h-full ${getProgressColor(dayMacros.calories, goals.calories)}`}
                />
              </div>
            </div>

            {/* Protein Progress */}
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Proteína</span>
                <span className={`text-sm font-mono font-bold ${getTextColor(dayMacros.protein, goals.protein)}`}>
                  {Math.round(dayMacros.protein)} / {goals.protein} g
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (dayMacros.protein / goals.protein) * 100)}%` }}
                  className={`h-full ${getProgressColor(dayMacros.protein, goals.protein)}`}
                />
              </div>
            </div>

            {/* Water Progress */}
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Droplets size={12} className="text-blue-500" />
                  Hidratação
                </span>
                <span className={`text-sm font-mono font-bold ${getTextColor(currentDay.waterConsumed, goals.water)}`}>
                  {currentDay.waterConsumed.toFixed(2)} / {goals.water.toFixed(2)} L
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (currentDay.waterConsumed / goals.water) * 100)}%` }}
                  className="h-full bg-blue-500"
                />
              </div>
              <div className="flex gap-2">
                {[0.25, 0.5, 1].map(amt => (
                  <button
                    key={amt}
                    onClick={() => updateWater(amt)}
                    className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] font-bold py-2 rounded-lg transition-colors border border-blue-100"
                  >
                    +{amt >= 1 ? `${amt}L` : `${amt * 1000}ml`}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const newPlan = [...weeklyPlan];
                    newPlan[selectedDayIndex].waterConsumed = 0;
                    setWeeklyPlan(newPlan);
                  }}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Planejamento Semanal */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Planejamento Semanal</h2>
            <button 
              onClick={() => setIsAddingFood(true)}
              className="text-[10px] font-bold uppercase bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full flex items-center gap-1"
            >
              <Plus size={12} />
              Novo Alimento
            </button>
          </div>

          <div className="space-y-4">
            {weeklyPlan.map((day, dayIdx) => (
              <div key={day.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <button 
                  onClick={() => setExpandedDays(prev => ({ ...prev, [dayIdx]: !prev[dayIdx] }))}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${getProgressColor(calculateDayMacros(day, foods).calories, goals.calories)}`} />
                    <span className="font-bold text-slate-700">{day.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-[10px] font-mono text-slate-400 uppercase">
                      {Math.round(calculateDayMacros(day, foods).calories)} kcal • {Math.round(calculateDayMacros(day, foods).protein)}g P
                    </div>
                    {expandedDays[dayIdx] ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                  </div>
                </button>

                <AnimatePresence>
                  {expandedDays[dayIdx] && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-100 px-6 py-4 space-y-6"
                    >
                      {day.meals.map((meal, mealIdx) => {
                        const mealMacros = calculateMealMacros(meal, foods);
                        return (
                          <div key={meal.id} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider">{meal.name}</h3>
                              <span className="text-[10px] font-mono text-slate-400">
                                {Math.round(mealMacros.calories)} kcal | {Math.round(mealMacros.protein)}g P
                              </span>
                            </div>
                            
                            <div className="space-y-2">
                              {meal.items.map((item, itemIdx) => {
                                const food = foods.find(f => f.id === item.foodId);
                                if (!food) return null;
                                return (
                                  <div key={itemIdx} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg group">
                                    <div className="flex items-center gap-3">
                                      <div className="text-xs font-medium text-slate-700">{food.name}</div>
                                      <div className="flex items-center gap-1">
                                        <input 
                                          type="number"
                                          step="0.1"
                                          value={item.quantity}
                                          onChange={(e) => updateItemQuantity(dayIdx, mealIdx, itemIdx, Number(e.target.value))}
                                          className="w-12 bg-white border border-slate-200 rounded px-1 py-0.5 text-[10px] font-mono text-center"
                                        />
                                        <span className="text-[10px] text-slate-400">{food.unit}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-[10px] font-mono text-slate-500">
                                        {Math.round(food.calories * item.quantity)} kcal
                                      </div>
                                      <button 
                                        onClick={() => removeFoodFromMeal(dayIdx, mealIdx, itemIdx)}
                                        className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                              
                              <div className="flex gap-2">
                                <select 
                                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      addItemToMeal(dayIdx, mealIdx, e.target.value);
                                      e.target.value = '';
                                    }
                                  }}
                                >
                                  <option value="">+ Adicionar Alimento</option>
                                  {foods.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Add Food Modal */}
      <AnimatePresence>
        {isAddingFood && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingFood(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl"
            >
              <h2 className="text-xl font-bold mb-6">Novo Alimento</h2>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Nome</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Arroz Integral"
                    value={newFood.name}
                    onChange={(e) => setNewFood({...newFood, name: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Calorias</label>
                    <input 
                      type="number" 
                      value={newFood.calories}
                      onChange={(e) => setNewFood({...newFood, calories: Number(e.target.value)})}
                      className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Proteína</label>
                    <input 
                      type="number" 
                      value={newFood.protein}
                      onChange={(e) => setNewFood({...newFood, protein: Number(e.target.value)})}
                      className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Unidade (ex: 100g, unidade)</label>
                  <input 
                    type="text" 
                    value={newFood.unit}
                    onChange={(e) => setNewFood({...newFood, unit: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setIsAddingFood(false)}
                    className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={addCustomFood}
                    className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Status */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${dayMacros.calories >= goals.calories ? 'bg-emerald-500' : 'bg-orange-400'}`} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status: {dayMacros.calories >= goals.calories ? 'Meta Atingida' : 'Em Progresso'}</span>
          </div>
          <div className="text-[10px] font-bold text-slate-300 uppercase">
            NutriPlan v1.0
          </div>
        </div>
      </footer>
    </div>
  );
}
