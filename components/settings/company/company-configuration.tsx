"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  COMPANY_DAY_OPTIONS,
  COMPANY_LANGUAGE_OPTIONS,
  COMPANY_MONTH_OPTIONS,
  COMPANY_TIME_ZONE_OPTIONS,
} from "../../../lib/company-management/localization";
import type {
  Branch,
  CompanyCurrency,
  CompanyLocalization,
  FiscalYear,
  Holiday,
  WorkingCalendar,
} from "../../../lib/company-management/types";
import type { ValidationErrors } from "../../../lib/company-management/validation";
import {
  CompanyInput,
  CompanySectionCard,
  CompanySelect,
  CompanyToggle,
} from "./company-form-controls";

export function CompanyFiscalYear({
  fiscalYear,
  errors,
  readOnly,
  onChange,
}: {
  fiscalYear: FiscalYear;
  errors: ValidationErrors;
  readOnly: boolean;
  onChange: (patch: Partial<FiscalYear>) => void;
}) {
  const year =
    Number(fiscalYear.fiscalYearName.match(/\d{4}/)?.[0]) ||
    new Date().getFullYear();
  const endYear =
    fiscalYear.endMonth < fiscalYear.startMonth ? year + 1 : year;
  return (
    <CompanySectionCard
      title="Fiscal Year"
      description="Configure one active period. Overlapping active periods are rejected when published."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CompanyInput
          label="Fiscal Year Name"
          value={fiscalYear.fiscalYearName}
          onChange={(event) => onChange({ fiscalYearName: event.target.value })}
          disabled={readOnly}
        />
        <CompanySelect
          label="Start Month"
          required
          value={fiscalYear.startMonth}
          onChange={(event) => onChange({ startMonth: Number(event.target.value) })}
          error={errors.startMonth}
          disabled={readOnly}
        >
          {COMPANY_MONTH_OPTIONS.map((month, index) => (
            <option key={month} value={index + 1}>
              {month}
            </option>
          ))}
        </CompanySelect>
        <CompanyInput
          label="Start Day"
          required
          type="number"
          min={1}
          max={31}
          value={fiscalYear.startDay}
          onChange={(event) => onChange({ startDay: Number(event.target.value) })}
          error={errors.startDay}
          disabled={readOnly}
        />
        <CompanySelect
          label="End Month"
          value={fiscalYear.endMonth}
          onChange={(event) => onChange({ endMonth: Number(event.target.value) })}
          error={errors.endMonth}
          disabled={readOnly}
        >
          {COMPANY_MONTH_OPTIONS.map((month, index) => (
            <option key={month} value={index + 1}>
              {month}
            </option>
          ))}
        </CompanySelect>
        <CompanyInput
          label="End Day"
          type="number"
          min={1}
          max={31}
          value={fiscalYear.endDay}
          onChange={(event) => onChange({ endDay: Number(event.target.value) })}
          error={errors.endDay}
          disabled={readOnly}
        />
        <CompanySelect
          label="Status"
          value={fiscalYear.status}
          onChange={(event) =>
            onChange({
              status:
                event.target.value === "disabled" ? "disabled" : "active",
            })
          }
          disabled={readOnly}
        >
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </CompanySelect>
      </div>
      <label className="mt-5 flex min-h-11 items-center justify-between gap-4 rounded-[var(--radius-control-lg)] bg-[var(--surface-subtle)] px-4">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          Current Fiscal Year
        </span>
        <CompanyToggle
          label="Current Fiscal Year"
          checked={fiscalYear.currentFiscalYear}
          onChange={(checked) => onChange({ currentFiscalYear: checked })}
          disabled={readOnly}
        />
      </label>
      <div className="mt-5 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4">
        <p className="text-xs font-semibold uppercase text-[var(--text-tertiary)]">
          Preview
        </p>
        <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
          {fiscalYear.fiscalYearName}
        </p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {fiscalYear.startDay}{" "}
          {COMPANY_MONTH_OPTIONS[fiscalYear.startMonth - 1]} {year} –{" "}
          {fiscalYear.endDay} {COMPANY_MONTH_OPTIONS[fiscalYear.endMonth - 1]}{" "}
          {endYear}
        </p>
      </div>
    </CompanySectionCard>
  );
}

export function CompanyCurrencySettings({
  currency,
  readOnly,
  onChange,
}: {
  currency: CompanyCurrency;
  readOnly: boolean;
  onChange: (patch: Partial<CompanyCurrency>) => void;
}) {
  return (
    <CompanySectionCard
      title="Currency"
      description="Phase 1 uses manually maintained exchange rates and never calls an external rate API."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CurrencySelect
          label="Primary Currency"
          value={currency.primaryCurrency}
          onChange={(value) => onChange({ primaryCurrency: value })}
          disabled={readOnly}
        />
        <CurrencySelect
          label="Display Currency"
          value={currency.displayCurrency}
          onChange={(value) => onChange({ displayCurrency: value })}
          disabled={readOnly}
        />
        <CompanyInput
          label="Currency Symbol"
          value={currency.currencySymbol}
          onChange={(event) => onChange({ currencySymbol: event.target.value })}
          disabled={readOnly}
        />
        <CompanySelect
          label="Decimal Places"
          value={currency.decimalPlaces}
          onChange={(event) =>
            onChange({ decimalPlaces: Number(event.target.value) })
          }
          disabled={readOnly}
        >
          <option value={0}>0</option>
          <option value={1}>1</option>
          <option value={2}>2</option>
        </CompanySelect>
        <CompanySelect
          label="Number Format"
          value={currency.numberFormat}
          onChange={(event) => onChange({ numberFormat: event.target.value })}
          disabled={readOnly}
        >
          <option value="1,234.56">1,234.56</option>
          <option value="1.234,56">1.234,56</option>
          <option value="1 234.56">1 234.56</option>
        </CompanySelect>
        <CompanySelect
          label="Negative Number Format"
          value={currency.negativeNumberFormat}
          onChange={(event) =>
            onChange({ negativeNumberFormat: event.target.value })
          }
          disabled={readOnly}
        >
          <option value="-1,234.56">-1,234.56</option>
          <option value="(1,234.56)">(1,234.56)</option>
        </CompanySelect>
        <CompanySelect
          label="Exchange Rate Source"
          value="manual"
          disabled
        >
          <option value="manual">Manual</option>
        </CompanySelect>
        <CompanyInput
          label="Manual Exchange Rate"
          type="number"
          min="0"
          step="0.0001"
          value={currency.manualExchangeRate}
          onChange={(event) =>
            onChange({
              manualExchangeRate: event.target.value,
              lastRateUpdate: new Date().toISOString(),
            })
          }
          disabled={readOnly}
        />
        <CompanyInput
          label="Last Rate Update"
          value={
            currency.lastRateUpdate
              ? new Date(currency.lastRateUpdate).toLocaleString()
              : "Not updated"
          }
          disabled
        />
      </div>
    </CompanySectionCard>
  );
}

export function CompanyLocalizationSettings({
  localization,
  readOnly,
  onChange,
}: {
  localization: CompanyLocalization;
  readOnly: boolean;
  onChange: (patch: Partial<CompanyLocalization>) => void;
}) {
  return (
    <CompanySectionCard
      title="Language & Time Zone"
      description="Locale values use stable language and time-zone codes."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CompanySelect
          label="Default Language"
          required
          value={localization.defaultLanguage}
          onChange={(event) =>
            onChange({
              defaultLanguage: event.target
                .value as CompanyLocalization["defaultLanguage"],
            })
          }
          disabled={readOnly}
        >
          {COMPANY_LANGUAGE_OPTIONS.map((language) => (
            <option key={language.code} value={language.code}>
              {language.label}
            </option>
          ))}
        </CompanySelect>
        <CompanySelect
          label="Fallback Language"
          value={localization.fallbackLanguage}
          onChange={(event) =>
            onChange({
              fallbackLanguage: event.target
                .value as CompanyLocalization["fallbackLanguage"],
            })
          }
          disabled={readOnly}
        >
          {COMPANY_LANGUAGE_OPTIONS.map((language) => (
            <option key={language.code} value={language.code}>
              {language.label}
            </option>
          ))}
        </CompanySelect>
        <CompanySelect
          label="Default Time Zone"
          required
          value={localization.defaultTimeZone}
          onChange={(event) =>
            onChange({
              defaultTimeZone: event.target
                .value as CompanyLocalization["defaultTimeZone"],
            })
          }
          disabled={readOnly}
        >
          {COMPANY_TIME_ZONE_OPTIONS.map((zone) => (
            <option key={zone.code} value={zone.code}>
              {zone.label}
            </option>
          ))}
        </CompanySelect>
        <CompanySelect
          label="Date Format"
          value={localization.dateFormat}
          onChange={(event) => onChange({ dateFormat: event.target.value })}
          disabled={readOnly}
        >
          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
        </CompanySelect>
        <CompanySelect
          label="Time Format"
          value={localization.timeFormat}
          onChange={(event) =>
            onChange({
              timeFormat:
                event.target.value === "12-hour" ? "12-hour" : "24-hour",
            })
          }
          disabled={readOnly}
        >
          <option value="24-hour">24-hour</option>
          <option value="12-hour">12-hour</option>
        </CompanySelect>
        <CompanySelect
          label="First Day of Week"
          value={localization.firstDayOfWeek}
          onChange={(event) =>
            onChange({ firstDayOfWeek: event.target.value })
          }
          disabled={readOnly}
        >
          {COMPANY_DAY_OPTIONS.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </CompanySelect>
      </div>
    </CompanySectionCard>
  );
}

export function CompanyWorkingCalendar({
  calendar,
  branches,
  readOnly,
  onChange,
}: {
  calendar: WorkingCalendar;
  branches: Branch[];
  readOnly: boolean;
  onChange: (patch: Partial<WorkingCalendar>) => void;
}) {
  const [holidayEditor, setHolidayEditor] = useState<Holiday | null>(null);
  const [isNew, setIsNew] = useState(false);

  function toggleWorkingDay(day: string) {
    const working = calendar.workingDays.includes(day);
    onChange({
      workingDays: working
        ? calendar.workingDays.filter((item) => item !== day)
        : [...calendar.workingDays, day],
      weekendDays: working
        ? [...new Set([...calendar.weekendDays, day])]
        : calendar.weekendDays.filter((item) => item !== day),
    });
  }

  function saveHoliday() {
    if (!holidayEditor?.holidayName.trim() || !holidayEditor.holidayDate) return;
    onChange({
      holidays: isNew
        ? [...calendar.holidays, holidayEditor]
        : calendar.holidays.map((item) =>
            item.id === holidayEditor.id ? holidayEditor : item,
          ),
    });
    setHolidayEditor(null);
  }

  return (
    <>
      <CompanySectionCard
        title="Working Calendar"
        description="Used by dashboard dates, working-day KPIs, and KAI analysis context."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Working Days
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {COMPANY_DAY_OPTIONS.map((day) => (
                <label
                  key={day}
                  className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] px-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={calendar.workingDays.includes(day)}
                    onChange={() => toggleWorkingDay(day)}
                    disabled={readOnly}
                    className="size-4 accent-[var(--brand-500)]"
                  />
                  {day}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">
              Weekend: {calendar.weekendDays.join(", ") || "None"}
            </p>
          </div>
          <div className="grid content-start gap-4 sm:grid-cols-2">
            <CompanyInput
              label="Working Start Time"
              type="time"
              value={calendar.workingStartTime}
              onChange={(event) =>
                onChange({ workingStartTime: event.target.value })
              }
              disabled={readOnly}
            />
            <CompanyInput
              label="Working End Time"
              type="time"
              value={calendar.workingEndTime}
              onChange={(event) =>
                onChange({ workingEndTime: event.target.value })
              }
              disabled={readOnly}
            />
          </div>
        </div>

        <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Public & Company Holidays
              </h3>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Holidays can repeat annually or apply to a specific branch.
              </p>
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={() => {
                  setIsNew(true);
                  setHolidayEditor({
                    id: crypto.randomUUID(),
                    holidayName: "",
                    holidayDate: "",
                    repeatAnnually: false,
                    branchId: "",
                    holidayType: "company",
                    status: "active",
                  });
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] px-3 text-sm font-semibold hover:bg-[var(--surface-subtle)]"
              >
                <Plus size={16} aria-hidden="true" />
                Add Holiday
              </button>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {calendar.holidays.map((holiday) => (
              <div
                key={holiday.id}
                className="flex flex-col gap-3 rounded-[var(--radius-control-lg)] bg-[var(--surface-subtle)] px-4 py-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {holiday.holidayName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {holiday.holidayDate}
                    {holiday.repeatAnnually ? " · Repeats annually" : ""}
                    {holiday.branchId
                      ? ` · ${branches.find((branch) => branch.id === holiday.branchId)?.branchName ?? "Branch"}`
                      : " · All branches"}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNew(false);
                        setHolidayEditor(holiday);
                      }}
                      aria-label={`Edit ${holiday.holidayName}`}
                      className="grid size-11 place-items-center rounded-[var(--radius-control)] hover:bg-white"
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          holidays: calendar.holidays.filter(
                            (item) => item.id !== holiday.id,
                          ),
                        })
                      }
                      aria-label={`Remove ${holiday.holidayName}`}
                      className="grid size-11 place-items-center rounded-[var(--radius-control)] text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)]"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!calendar.holidays.length && (
              <div className="grid min-h-28 place-items-center rounded-[var(--radius-control-lg)] border border-dashed border-[var(--border-default)] text-sm text-[var(--text-secondary)]">
                No holidays configured.
              </div>
            )}
          </div>
        </div>
      </CompanySectionCard>

      {holidayEditor && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-[var(--text-primary)]/25 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="holiday-dialog-title"
        >
          <div className="w-full max-w-lg rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--surface-default)] shadow-[var(--shadow-overlay)]">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-5 py-4">
              <h2
                id="holiday-dialog-title"
                className="text-lg font-semibold text-[var(--text-primary)]"
              >
                {isNew ? "Add Holiday" : "Edit Holiday"}
              </h2>
              <button
                type="button"
                onClick={() => setHolidayEditor(null)}
                className="grid size-11 place-items-center rounded-[var(--radius-control)] hover:bg-[var(--surface-subtle)]"
                aria-label="Close holiday editor"
              >
                <X size={19} aria-hidden="true" />
              </button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <CompanyInput
                label="Holiday Name"
                required
                value={holidayEditor.holidayName}
                onChange={(event) =>
                  setHolidayEditor({
                    ...holidayEditor,
                    holidayName: event.target.value,
                  })
                }
              />
              <CompanyInput
                label="Date"
                required
                type="date"
                value={holidayEditor.holidayDate}
                onChange={(event) =>
                  setHolidayEditor({
                    ...holidayEditor,
                    holidayDate: event.target.value,
                  })
                }
              />
              <CompanySelect
                label="Holiday Type"
                value={holidayEditor.holidayType}
                onChange={(event) =>
                  setHolidayEditor({
                    ...holidayEditor,
                    holidayType:
                      event.target.value === "public" ? "public" : "company",
                  })
                }
              >
                <option value="public">Public Holiday</option>
                <option value="company">Company Holiday</option>
              </CompanySelect>
              <CompanySelect
                label="Branch"
                value={holidayEditor.branchId}
                onChange={(event) =>
                  setHolidayEditor({
                    ...holidayEditor,
                    branchId: event.target.value,
                  })
                }
              >
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.branchName}
                  </option>
                ))}
              </CompanySelect>
              <label className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-control-lg)] bg-[var(--surface-subtle)] px-3 sm:col-span-2">
                <span className="text-sm font-medium">Repeat Annually</span>
                <CompanyToggle
                  label="Repeat holiday annually"
                  checked={holidayEditor.repeatAnnually}
                  onChange={(checked) =>
                    setHolidayEditor({
                      ...holidayEditor,
                      repeatAnnually: checked,
                    })
                  }
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border-default)] px-5 py-4">
              <button
                type="button"
                onClick={() => setHolidayEditor(null)}
                className="min-h-11 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] px-4 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveHoliday}
                disabled={
                  !holidayEditor.holidayName.trim() ||
                  !holidayEditor.holidayDate
                }
                className="min-h-11 rounded-[var(--radius-control-lg)] bg-[var(--brand-500)] px-4 text-sm font-semibold text-white disabled:opacity-45"
              >
                Save Holiday
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CurrencySelect({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: CompanyCurrency["primaryCurrency"];
  onChange: (value: CompanyCurrency["primaryCurrency"]) => void;
  disabled: boolean;
}) {
  return (
    <CompanySelect
      label={label}
      required
      value={value}
      onChange={(event) =>
        onChange(event.target.value as CompanyCurrency["primaryCurrency"])
      }
      disabled={disabled}
    >
      <option value="MMK">MMK</option>
      <option value="THB">THB</option>
      <option value="USD">USD</option>
    </CompanySelect>
  );
}
