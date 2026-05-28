'use client';

import Modal from './ui/Modal';

export default function ContactModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="联系作者" maxWidth="max-w-sm">
      <div className="flex flex-col items-center space-y-4">
        <img
          src="/qrcode.png"
          alt="微信二维码"
          className="w-48 rounded-lg"
          onError={(e) => {
            e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='192' height='192' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-family='sans-serif' font-size='14' fill='%236b7280'%3E二维码暂未上传%3C/text%3E%3C/svg%3E";
          }}
        />
        <p className="text-gray-500 text-sm text-center">
          扫描二维码，添加作者微信
        </p>
      </div>
    </Modal>
  );
}