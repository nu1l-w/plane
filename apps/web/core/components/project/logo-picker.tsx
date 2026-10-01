import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { EmojiPicker, EmojiIconPickerTypes, Logo } from "@plane/propel/emoji-icon-picker";
import type { TLogoProps } from "@plane/types";
import { getProjectLogoFileError, PROJECT_LOGO_ACCEPT } from "./logo-upload";

type Props = {
  value: TLogoProps;
  image: File | null;
  onChange: (value: TLogoProps) => void;
  onImageChange: (file: File | null) => void;
  disabled?: boolean;
};

export function ProjectLogoPicker({ value, image, onChange, onImageChange, disabled = false }: Props) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!image) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  return (
    <div className="flex shrink-0 flex-col items-start gap-1">
      <input
        ref={inputRef}
        type="file"
        accept={PROJECT_LOGO_ACCEPT}
        aria-label={t("project_settings.general.logo.upload")}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file || disabled) return;
          const fileError = getProjectLogoFileError(file);
          setError(fileError);
          if (fileError) return;
          onImageChange(file);
          setIsOpen(false);
        }}
      />
      <EmojiPicker
        iconType="material"
        isOpen={isOpen}
        handleToggle={setIsOpen}
        buttonClassName="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg bg-white/10"
        label={
          <span aria-label={t("project_settings.general.logo.label")}>
            {preview ? (
              <img src={preview} alt="" className="size-7 rounded-sm object-contain" />
            ) : (
              <Logo logo={value} size={28} />
            )}
          </span>
        }
        onChange={(selection) => {
          onImageChange(null);
          setError(undefined);
          onChange(
            selection.type === "emoji"
              ? { in_use: "emoji", emoji: { value: selection.value } }
              : { in_use: "icon", icon: selection.value }
          );
          setIsOpen(false);
        }}
        defaultIconColor={value?.in_use === "icon" ? value.icon?.color : undefined}
        defaultOpen={value?.in_use === "icon" ? EmojiIconPickerTypes.ICON : EmojiIconPickerTypes.EMOJI}
        disabled={disabled}
        footer={
          <div className="space-y-2">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-4" />
              {t("project_settings.general.logo.upload")}
            </Button>
            <p className="text-11 text-secondary">{t("project_settings.general.logo.hint")}</p>
            {error && (
              <p role="alert" className="text-11 text-danger-primary">
                {t(error)}
              </p>
            )}
          </div>
        }
      />
      {image && <span className="text-11 text-on-color">{t("project_settings.general.logo.pending")}</span>}
    </div>
  );
}
