fn fixture(input: &str) {
    // ruleid: rust-no-shell-process
    let _child = std::process::Command::new(input);
    // ruleid: rust-no-formatted-sql
    let _query = sqlx::query(&format!("SELECT * FROM users WHERE name='{}'", input));
    // ok: rust-no-formatted-sql
    let _safe = sqlx::query("SELECT * FROM users WHERE name=$1").bind(input);
}
