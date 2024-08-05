export default function Note({
  code,
  company,
  locationCode,
  locationID,
  content,
  tech,
  date,
  time,
  ...props
}) {
  return (
    <>
      <div className="text-3xl font-bold">{code?.split(' ')[0]}</div>
      <div className="text-xl font-bold">
        <a
          href={`https://app.pestpac.com/location/detail.asp?LocationID=${locationID}`}
        >
          {company} - {locationCode}
        </a>
      </div>
      <div className="content my-5">{content}</div>
      <div className="text-lg font-semibold">{tech}</div>
    </>
  )
}
