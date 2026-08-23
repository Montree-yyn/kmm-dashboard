import Image from "next/image";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import type { ChangeEvent, RefObject } from "react";
import type {
  CompanyProfile,
} from "../../../lib/company-management/types";
import type { ValidationErrors } from "../../../lib/company-management/validation";
import {
  CompanyInput,
  CompanySectionCard,
  CompanySelect,
  CompanyTextarea,
} from "./company-form-controls";

export function CompanyGeneralInformation({
  company,
  errors,
  readOnly,
  canDisable,
  uploading,
  fileInputRef,
  onChange,
  onLogoSelect,
  onLogoRemove,
}: {
  company: CompanyProfile;
  errors: ValidationErrors;
  readOnly: boolean;
  canDisable: boolean;
  uploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onChange: (patch: Partial<CompanyProfile>) => void;
  onLogoSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onLogoRemove: () => void;
}) {
  return (
    <div className="space-y-5">
      <CompanySectionCard
        title="Company Identity"
        description="Core identity used across the KMM enterprise workspace."
      >
        <div className="grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)]">
          <div>
            <div className="grid aspect-square place-items-center overflow-hidden rounded-[var(--radius-card)] border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)]">
              {company.logoUrl ? (
                <Image
                  src={company.logoUrl}
                  alt={`${company.companyName} logo`}
                  width={180}
                  height={180}
                  unoptimized
                  className="h-full w-full object-contain p-4"
                />
              ) : (
                <ImagePlus
                  size={34}
                  className="text-[var(--text-disabled)]"
                  aria-hidden="true"
                />
              )}
            </div>
            {!readOnly && (
              <div className="mt-3 grid gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                  onChange={onLogoSelect}
                  className="sr-only"
                  aria-label="Upload Company Logo"
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control-lg)] border border-[var(--border-default)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-45"
                >
                  <Upload size={15} aria-hidden="true" />
                  {uploading
                    ? "Uploading..."
                    : company.logoUrl
                      ? "Replace Logo"
                      : "Upload Logo"}
                </button>
                {company.logoUrl && (
                  <button
                    type="button"
                    onClick={onLogoRemove}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control-lg)] px-3 text-xs font-semibold text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    Remove Logo
                  </button>
                )}
              </div>
            )}
            <p className="mt-2 text-[11px] leading-5 text-[var(--text-tertiary)]">
              PNG, JPG, or SVG. Maximum 5 MB.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <CompanyInput
              label="Company Name"
              required
              value={company.companyName}
              onChange={(event) => onChange({ companyName: event.target.value })}
              error={errors.companyName}
              disabled={readOnly}
            />
            <CompanyInput
              label="Company Code"
              required
              value={company.companyCode}
              onChange={(event) =>
                onChange({ companyCode: event.target.value.toUpperCase() })
              }
              error={errors.companyCode}
              disabled={readOnly}
              maxLength={20}
            />
            <CompanyInput
              label="Legal Name"
              value={company.legalName}
              onChange={(event) => onChange({ legalName: event.target.value })}
              disabled={readOnly}
            />
            <CompanySelect
              label="Status"
              value={company.status}
              onChange={(event) =>
                onChange({
                  status:
                    event.target.value === "disabled" ? "disabled" : "active",
                })
              }
              disabled={readOnly || !canDisable}
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </CompanySelect>
          </div>
        </div>
      </CompanySectionCard>

      <CompanySectionCard
        title="Business Information"
        description="Legal, contact, and operating details."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CompanyInput
            label="Tax ID"
            value={company.taxId}
            onChange={(event) => onChange({ taxId: event.target.value })}
            disabled={readOnly}
          />
          <CompanyInput
            label="Registration Number"
            value={company.registrationNumber}
            onChange={(event) =>
              onChange({ registrationNumber: event.target.value })
            }
            disabled={readOnly}
          />
          <CompanyInput
            label="Business Type"
            value={company.businessType}
            onChange={(event) => onChange({ businessType: event.target.value })}
            disabled={readOnly}
          />
          <CompanyInput
            label="Industry"
            value={company.industry}
            onChange={(event) => onChange({ industry: event.target.value })}
            disabled={readOnly}
          />
          <CompanyInput
            label="Established Year"
            type="number"
            value={company.establishedYear ?? ""}
            onChange={(event) =>
              onChange({
                establishedYear: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
            error={errors.establishedYear}
            disabled={readOnly}
          />
          <CompanyInput
            label="Website"
            type="url"
            value={company.website}
            onChange={(event) => onChange({ website: event.target.value })}
            error={errors.website}
            disabled={readOnly}
            placeholder="https://"
          />
          <CompanyInput
            label="Email"
            required
            type="email"
            value={company.email}
            onChange={(event) => onChange({ email: event.target.value })}
            error={errors.email}
            disabled={readOnly}
          />
          <CompanyInput
            label="Phone"
            type="tel"
            value={company.phone}
            onChange={(event) => onChange({ phone: event.target.value })}
            disabled={readOnly}
          />
          <CompanyTextarea
            label="Address"
            value={company.address}
            onChange={(event) => onChange({ address: event.target.value })}
            disabled={readOnly}
            className="sm:col-span-2"
          />
          <CompanyTextarea
            label="Description"
            value={company.description}
            onChange={(event) => onChange({ description: event.target.value })}
            disabled={readOnly}
            className="sm:col-span-2"
          />
        </div>
      </CompanySectionCard>
    </div>
  );
}
