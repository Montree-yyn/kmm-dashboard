"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { auth } from "../../lib/firebase";
import { setActiveCompany } from "../../lib/company-context/client-store";
import type {
  AuthorizedCompany,
  CompanyContextPayload,
} from "../../lib/company-context/types";

type CompanyContextValue = {
  companies: AuthorizedCompany[];
  selectedCompany: AuthorizedCompany | null;
  loading: boolean;
  error: string | null;
  switchCompany: (companyId: string) => void;
  refreshCompanies: () => Promise<void>;
};

export const CompanyContext = createContext<CompanyContextValue | null>(null);

function storageKey(userId: string) {
  return `kmm-active-company-v1:${userId}`;
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<AuthorizedCompany[]>([]);
  const [selectedCompany, setSelectedCompanyState] = useState<AuthorizedCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const applySelection = useCallback((company: AuthorizedCompany, persist = true) => {
    setActiveCompany(company);
    setSelectedCompanyState(company);
    document.documentElement.dataset.company = company.code.toLowerCase();
    if (persist && auth.currentUser) {
      window.localStorage.setItem(storageKey(auth.currentUser.uid), company.id);
    }
  }, []);

  const refreshCompanies = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      await auth.authStateReady();
      const user = auth.currentUser;
      const token = await user?.getIdToken();
      if (!user || !token) throw new Error("Your secure session has expired. Sign in again.");

      const response = await fetch("/api/company-context", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json() as CompanyContextPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load company access.");
      if (!payload.companies.length) throw new Error("No active company membership is available.");
      if (currentRequest !== requestId.current) return;

      const requestedId = new URLSearchParams(window.location.search).get("companyId")?.trim();
      const savedId = window.localStorage.getItem(storageKey(user.uid));
      const selected = payload.companies.find((company) => company.id === requestedId)
        ?? payload.companies.find((company) => company.id === savedId)
        ?? payload.companies.find((company) => company.id === payload.selectedCompanyId)
        ?? payload.companies[0];
      setCompanies(payload.companies);
      applySelection(selected, false);
    } catch (loadError) {
      if (currentRequest !== requestId.current) return;
      setActiveCompany(null);
      setSelectedCompanyState(null);
      setCompanies([]);
      setError(loadError instanceof Error ? loadError.message : "Unable to load company access.");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [applySelection]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void refreshCompanies();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      requestId.current += 1;
      setActiveCompany(null);
      delete document.documentElement.dataset.company;
    };
  }, [refreshCompanies]);

  const switchCompany = useCallback((companyId: string) => {
    const next = companies.find((company) => company.id === companyId);
    if (!next || next.id === selectedCompany?.id) return;
    applySelection(next);
    const url = new URL(window.location.href);
    if (url.searchParams.has("companyId")) {
      url.searchParams.set("companyId", next.id);
      window.history.replaceState(window.history.state, "", url);
    }
    window.dispatchEvent(new CustomEvent("kmm:company-changed", {
      detail: { companyId: next.id, companyCode: next.code },
    }));
  }, [applySelection, companies, selectedCompany?.id]);

  const value = useMemo<CompanyContextValue>(() => ({
    companies,
    selectedCompany,
    loading,
    error,
    switchCompany,
    refreshCompanies,
  }), [companies, error, loading, refreshCompanies, selectedCompany, switchCompany]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}
