interface LegalContactFooterProps {
  effectiveDateText: string;
  contactPrefixText: string;
}

export default function LegalContactFooter({
  effectiveDateText,
  contactPrefixText,
}: LegalContactFooterProps) {
  return (
    <>
      <p className="text-sm text-gray-500">{effectiveDateText}</p>
      <p className="mt-2 text-sm text-gray-500">
        {contactPrefixText}{" "}
        <a
          href="mailto:dldbstls7777@naver.com"
          className="text-orange-600 hover:text-orange-700"
        >
          dldbstls7777@naver.com
        </a>
        으로 연락주시기 바랍니다.
      </p>
    </>
  );
}
