// Custom hook for localStorage integration with React

import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  // Track loading state to avoid hydration mismatch
  const [isLoaded, setIsLoaded] = useState(false);
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Initialize from localStorage on client side
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;

      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.error(`localStorage error for key "${key}":`, error);
    } finally {
      setIsLoaded(true);
    }
  }, [key]);

  // Set value in both state and localStorage
  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error(`Failed to set localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}
