/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState, Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
// plane imports
import { Button } from "@plane/propel/button";
import { InstanceService } from "@plane/services";
// ui
import { Input } from "@plane/ui";

type Props = {
  isOpen: boolean;
  handleClose: () => void;
};

enum ESendEmailSteps {
  SEND_EMAIL = "SEND_EMAIL",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

const instanceService = new InstanceService();

export function SendTestEmailModal(props: Props) {
  const { isOpen, handleClose } = props;

  // state
  const [receiverEmail, setReceiverEmail] = useState("");
  const [sendEmailStep, setSendEmailStep] = useState<ESendEmailSteps>(ESendEmailSteps.SEND_EMAIL);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // reset state
  const resetState = () => {
    setReceiverEmail("");
    setSendEmailStep(ESendEmailSteps.SEND_EMAIL);
    setIsLoading(false);
    setError("");
  };

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();

    setIsLoading(true);
    try {
      await instanceService.sendTestEmail(receiverEmail);
      setSendEmailStep(ESendEmailSteps.SUCCESS);
    } catch (caughtError) {
      console.error("Failed to send test email", caughtError);
      setError("测试邮件发送失败，请检查 SMTP 配置后重试。");
      setSendEmailStep(ESendEmailSteps.FAILED);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-20" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-backdrop transition-opacity" />
        </Transition.Child>
        <div className="fixed inset-0 z-20 overflow-y-auto">
          <div className="my-10 flex justify-center p-4 text-center sm:p-0 md:my-20">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative w-full transform rounded-lg bg-surface-1 p-5 px-4 text-left shadow-raised-200 transition-all sm:max-w-xl">
                <h3 className="text-16 leading-6 font-medium text-primary">
                  {sendEmailStep === ESendEmailSteps.SEND_EMAIL
                    ? "发送测试邮件"
                    : sendEmailStep === ESendEmailSteps.SUCCESS
                      ? "邮件已发送"
                      : "发送失败"}{" "}
                </h3>
                <div className="pt-6 pb-2">
                  {sendEmailStep === ESendEmailSteps.SEND_EMAIL && (
                    <Input
                      id="receiver_email"
                      type="email"
                      value={receiverEmail}
                      onChange={(e) => setReceiverEmail(e.target.value)}
                      placeholder="收件人邮箱"
                      className="w-full resize-none text-16"
                      tabIndex={0}
                    />
                  )}
                  {sendEmailStep === ESendEmailSteps.SUCCESS && (
                    <div className="flex flex-col gap-y-4 text-13">
                      <p>测试邮件已发送至 {receiverEmail}。如果收件箱中没有，请检查垃圾邮件文件夹。</p>
                      <p>如果仍未收到，请检查 SMTP 配置后重新发送测试邮件。</p>
                    </div>
                  )}
                  {sendEmailStep === ESendEmailSteps.FAILED && <div className="text-13">{error}</div>}
                  <div className="mt-5 flex items-center justify-end gap-2">
                    <Button variant="secondary" size="lg" onClick={handleClose} tabIndex={0}>
                      {sendEmailStep === ESendEmailSteps.SEND_EMAIL ? "取消" : "关闭"}
                    </Button>
                    {sendEmailStep === ESendEmailSteps.SEND_EMAIL && (
                      <Button variant="primary" size="lg" loading={isLoading} onClick={handleSubmit} tabIndex={0}>
                        {isLoading ? "正在发送…" : "发送邮件"}
                      </Button>
                    )}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
