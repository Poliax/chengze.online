// Pair normal sessions first. Legacy link repairs created separate zero-length
// sessions for each file; only accept one unambiguous, near-simultaneous pair.
module.exports = function cameraPair(main, replays, sessionFor) {
  if (!main) return null;
  const cameras = replays.filter(r => r.id !== main.id && Number(r.course_id) === Number(main.course_id) && Number(r.lesson_id) > 0 && Number(r.lesson_id) === Number(main.lesson_id) && String(r.title || '').includes('老师') && r.video_url);
  const exact = cameras.find(r => Number(r.session_id) === Number(main.session_id));
  if (exact) return exact;
  const time = v => Date.parse(String(v || '').replace(' ', 'T') + 'Z');
  const repaired = r => {
    const s = sessionFor(r.session_id);
    return s && Number(s.course_id) === Number(r.course_id) && !s.lesson_id && s.started_at === s.ended_at && s.started_at === r.created_at;
  };
  if (!repaired(main)) return null;
  const matches = cameras.filter(r => repaired(r) && Math.abs(time(r.created_at) - time(main.created_at)) <= 5000 && Math.abs(Number(r.duration) - Number(main.duration)) <= 5);
  return matches.length === 1 ? matches[0] : null;
};
