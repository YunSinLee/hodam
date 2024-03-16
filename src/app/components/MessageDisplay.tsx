export default function MessageDisplay({
  messages,
}: {
  messages: { text: string }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((message, index) => (
        <p className="text-xl leading-8" key={index}>
          {message.text}
        </p>
      ))}
    </div>
  );
}
