import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmojiPicker } from "./emoji-picker";

const meta = {
  title: "Components/Emoji/EmojiPickerFooter",
  component: EmojiPicker,
  parameters: { layout: "centered" },
} satisfies Meta<typeof EmojiPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UploadAction: Story = {
  args: { isOpen: false, handleToggle: () => {}, onChange: () => {}, label: "Choose project icon" },
  render() {
    const [isOpen, setIsOpen] = useState(false);
    const [fileName, setFileName] = useState<string>();
    const inputRef = useRef<HTMLInputElement>(null);
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Upload image"
          hidden
          onChange={(event) => {
            setFileName(event.target.files?.[0]?.name);
            setIsOpen(false);
          }}
        />
        <EmojiPicker
          isOpen={isOpen}
          handleToggle={setIsOpen}
          onChange={() => setIsOpen(false)}
          label={fileName ?? "Choose project icon"}
          footer={
            <button type="button" onClick={() => inputRef.current?.click()}>
              Upload image
            </button>
          }
        />
      </>
    );
  },
};
