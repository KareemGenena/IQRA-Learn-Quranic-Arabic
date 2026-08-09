/**
 * Which class you are working in.
 *
 * Everything class-shaped — the note sheet above all — belongs to one class,
 * and a teacher may run several. So the app carries a current class the way it
 * carries a current lesson, and says which one it is wherever that matters.
 * Mixing up two classes' notes would be worse than having none.
 *
 * The choice is remembered on the device rather than on the account: it is a
 * "where am I working right now", not a fact about the person.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { myClasses, myEnrolments } from './classes';
import type { Account } from './useAccount';

export interface ClassOption {
  id: string;
  name: string;
  teacherName: string;
  /** Teaching it, or learning in it. Someone can do both, in different classes. */
  youAre: 'teacher' | 'student';
}

const ACTIVE_KEY = 'iqra-active-class';

export interface Classes {
  options: ClassOption[] | null;
  active: ClassOption | null;
  setActive: (id: string) => void;
  /** True while the first load is still running. */
  loading: boolean;
  reload: () => void;
}

export function useClasses(account: Account): Classes {
  const [options, setOptions] = useState<ClassOption[] | null>(null);
  const [activeId, setActiveId] = useState<string>(() => localStorage.getItem(ACTIVE_KEY) ?? '');
  const [tick, setTick] = useState(0);

  const signedIn = account.signedIn;
  const isTeacher = account.isTeacher;

  useEffect(() => {
    if (!signedIn) {
      setOptions([]);
      return;
    }
    let alive = true;

    // Both sides are asked for: teaching one class does not stop you learning
    // in someone else's, and the switcher should show every class you are in.
    Promise.all([
      isTeacher ? myClasses().catch(() => []) : Promise.resolve([]),
      myEnrolments().catch(() => []),
    ])
      .then(([taught, enrolled]) => {
        if (!alive) return;
        const mine: ClassOption[] = taught.map((k) => ({
          id: k.id,
          name: k.name,
          teacherName: k.teacherName,
          youAre: 'teacher',
        }));
        // Only classes actually joined — a pending request is not a place to
        // be writing notes yet.
        for (const e of enrolled) {
          if (e.status !== 'approved') continue;
          if (mine.some((m) => m.id === e.classId)) continue;
          mine.push({ id: e.classId, name: e.className, teacherName: e.teacherName, youAre: 'student' });
        }
        setOptions(mine);
      })
      .catch(() => alive && setOptions([]));

    return () => {
      alive = false;
    };
  }, [signedIn, isTeacher, tick]);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      // Only costs the app remembering the choice next time.
    }
  }, []);

  // A remembered class can disappear — left, removed, or deleted — so the
  // stored id is a suggestion, never the answer.
  const active = useMemo(() => {
    if (!options?.length) return null;
    return options.find((o) => o.id === activeId) ?? options[0];
  }, [options, activeId]);

  return {
    options,
    active,
    setActive,
    loading: options === null,
    reload: useCallback(() => setTick((t) => t + 1), []),
  };
}
