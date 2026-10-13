import { useEffect, useRef } from "react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import DateObject from "react-date-object";
import { Calendar } from "lucide-react";

function getPersianDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tehran" }).formatToParts(d);
    const p = {};
    parts.forEach((part) => { if (part.type !== "literal") p[part.type] = part.value; });
    return `${p.year}/${p.month}/${p.day}`;
  } catch {
    return "";
  }
}

const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

function toLatinDigits(str) {
  return String(str)
    .replace(/[۰-۹]/g, (d) => persianDigits.indexOf(d))
    .replace(/[٠-٩]/g, (d) => arabicDigits.indexOf(d));
}

export { getPersianDate };

export default function PersianDatePicker({
  value,
  onChange,
  placeholder = "انتخاب تاریخ",
  required = false,
  label,
  range = false,
  onlyMonthPicker = false,
  onlyYearPicker = false,
  timePicker = false,
  format = undefined,
  restrictToToday = false,
  disabled = false,
}) {
  const ref = useRef();
  const wrapperRef = useRef(null);
  useEffect(() => {
    const closeOnOutsidePointer = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        ref.current?.closeCalendar?.();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);
  const today = getPersianDate(0);
  const tomorrow = getPersianDate(1);
  const dayAfter = getPersianDate(2);

  const quickButtons = [
    { label: "امروز", value: today },
    { label: "فردا", value: tomorrow },
    { label: "پس‌فردا", value: dayAfter },
  ];

  const dateFormat = format || (timePicker ? "YYYY/MM/DD HH:mm" : "YYYY/MM/DD");
  const todayDateObject = restrictToToday
    ? new DateObject({ date: today, calendar: persian, locale: persian_fa, format: "YYYY/MM/DD" })
    : undefined;

  const handleChange = (dateObject) => {
    if (!dateObject) {
      onChange("");
      return;
    }
    if (range && Array.isArray(dateObject)) {
      const formatted = dateObject.map((d) => toLatinDigits(d.format("YYYY/MM/DD"))).join(" ~ ");
      onChange(formatted);
      return;
    }
    const nextValue = toLatinDigits(dateObject.format(dateFormat));
    if (restrictToToday && nextValue.slice(0, 10) !== today) return;
    onChange(nextValue);
  };

  let datePickerValue;
  if (value) {
    try {
      if (range) {
        const parts = String(value).split(" ~ ").filter(Boolean);
        datePickerValue = parts.map(
          (p) => new DateObject({ date: toLatinDigits(p), calendar: persian, locale: persian_fa, format: "YYYY/MM/DD" })
        );
      } else {
        datePickerValue = new DateObject({ date: toLatinDigits(value), calendar: persian, locale: persian_fa, format: dateFormat });
      }
    } catch {
      datePickerValue = undefined;
    }
  }

  const mapDays = ({ date }) => {
    // Friday = weekend in Persian calendar (dayOfWeek 6 in persian_fa locale, or 5 in JS getDay)
    if (date.dayOfWeek === 6 || date.dayOfWeek === 5) {
      return { className: "rmdp-holiday" };
    }
  };

  return (
    <div ref={wrapperRef}>
      {label && (
        <label className="text-sm font-medium block mb-1.5">
          {label} {required && <span className="text-[#D35400]">*</span>}
        </label>
      )}
      <div className="relative w-full">
        <DatePicker
          ref={ref}
          value={datePickerValue}
          onChange={handleChange}
          calendar={persian}
          locale={persian_fa}
          format={dateFormat}
          range={range}
          onlyMonthPicker={onlyMonthPicker}
          onlyYearPicker={onlyYearPicker}
          mapDays={mapDays}
          minDate={todayDateObject}
          maxDate={todayDateObject}
          editable={!restrictToToday}
          disabled={disabled}
          calendarPosition="bottom-right"
          weekDays={["ش", "ی", "د", "س", "چ", "پ", "ج"]}
          placeholder={placeholder}
          style={{ width: "100%" }}
          inputClass="rmdp-persian-input"
        />
        <Calendar
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground cursor-pointer z-10"
          onClick={() => ref.current?.openCalendar()}
        />
      </div>
      {!range && !onlyMonthPicker && !onlyYearPicker && !timePicker && !restrictToToday && !disabled && (
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          {quickButtons.map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={() => onChange(btn.value)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                value === btn.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-muted-foreground hover:bg-primary/10"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
