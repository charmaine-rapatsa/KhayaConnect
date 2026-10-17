import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import UnsavedChangesDialog from "../components/UnsavedChangesDialog";

function editableFields(form) {
  return [...form.elements].filter((field) =>
    !field.disabled && !["button", "submit", "reset", "hidden"].includes(field.type)
  );
}

function fieldValue(field) {
  if (field.type === "checkbox" || field.type === "radio") return field.checked;
  if (field.tagName === "SELECT" && field.multiple) {
    return [...field.selectedOptions].map((option) => option.value).join("\u0000");
  }
  return field.value;
}

function takeFormSnapshot(form) {
  return new Map(editableFields(form).map((field) => [field, fieldValue(field)]));
}

function formHasUnsavedChanges(form, baseline) {
  if (!baseline) return false;
  return editableFields(form).some((field) => baseline.has(field) && baseline.get(field) !== fieldValue(field));
}

export default function useDashboardSection(defaultSection, allowedSections) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const formSnapshots = useRef(new WeakMap());
  const requestedSection = searchParams.get("section");
  // The section query is shared by every dashboard. When switching roles, a
  // stale section from another dashboard must not leave the new page empty.
  const activeSection = requestedSection && allowedSections && !allowedSections.includes(requestedSection)
    ? defaultSection
    : requestedSection || defaultSection;

  useEffect(() => {
    const rememberNewForms = () => {
      document.querySelectorAll("form").forEach((form) => {
        if (!formSnapshots.current.has(form)) formSnapshots.current.set(form, takeFormSnapshot(form));
      });
    };
    const handleSaved = (event) => {
      const form = event.detail?.form;
      if (form instanceof HTMLFormElement) {
        window.requestAnimationFrame(() => formSnapshots.current.set(form, takeFormSnapshot(form)));
      }
    };
    const handleReset = (event) => {
      if (event.target instanceof HTMLFormElement) {
        window.requestAnimationFrame(() => formSnapshots.current.set(event.target, takeFormSnapshot(event.target)));
      }
    };
    rememberNewForms();
    const observer = new MutationObserver(rememberNewForms);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("khaya:form-saved", handleSaved);
    document.addEventListener("reset", handleReset, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("khaya:form-saved", handleSaved);
      document.removeEventListener("reset", handleReset, true);
    };
  }, []);
  const applySection = useCallback((section, options = {}) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (section === defaultSection) next.delete("section");
      else next.set("section", section);
      if (section !== "recents") next.delete("activity");
      return next;
    }, options);
  }, [defaultSection, setSearchParams]);
  const setActiveSection = useCallback((section, options = {}) => {
    const hasUnsavedFormValues = [...document.querySelectorAll("form")].some((form) =>
      formHasUnsavedChanges(form, formSnapshots.current.get(form))
    );
    if (hasUnsavedFormValues) {
      setPendingNavigation({ section, options });
      return;
    }
    applySection(section, options);
  }, [applySection]);
  const navigationGuard = pendingNavigation && createElement(UnsavedChangesDialog, {
    onStay: () => setPendingNavigation(null),
    onLeave: () => {
      const { section, options } = pendingNavigation;
      setPendingNavigation(null);
      applySection(section, options);
    },
  });
  return [activeSection, setActiveSection, navigationGuard];
}
