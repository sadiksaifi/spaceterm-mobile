//! Follows each connected Machine's Inventory, so a new revision reaches every change listener.
use spaceterm_client::connection::link::{LinkEvent, LinkSink};
use spaceterm_client::{DirectConnections, DirectRouteId, PairedMachine};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub(crate) struct Inventories {
    listeners: Arc<Mutex<Vec<async_channel::Sender<()>>>>,
    /// Held here: a connection keeps only a weak reference to it.
    sink: Arc<dyn LinkSink>,
    /// The connection each Machine's revisions are followed on.
    followed: Mutex<HashMap<DirectRouteId, PairedMachine>>,
}

impl Inventories {
    pub(crate) fn new() -> Self {
        let listeners: Arc<Mutex<Vec<async_channel::Sender<()>>>> = Arc::default();
        let notified = Arc::clone(&listeners);
        let sink: Arc<dyn LinkSink> = Arc::new(move |event: LinkEvent| {
            if let LinkEvent::Inventory(_) = event {
                notify(&notified);
            }
        });
        Self {
            listeners,
            sink,
            followed: Mutex::default(),
        }
    }

    /// Follows the connection of each connected Machine not followed yet. Runs after each change
    /// to the Machines, before listeners read them.
    pub(crate) fn follow(&self, connections: &DirectConnections) {
        let Ok(mut followed) = self.followed.lock() else {
            return;
        };
        let routes = connections.routes();
        followed.retain(|id, _| routes.iter().any(|(route, _)| route == id));
        for (id, _) in routes {
            let Some(core) = connections.core(&id) else {
                followed.remove(&id);
                continue;
            };
            if followed
                .get(&id)
                .is_none_or(|held| !held.same_handle(&core))
            {
                core.subscribe(Arc::downgrade(&self.sink));
                followed.insert(id, core);
            }
        }
    }

    /// A new listener. A revision reaches it as one message; several before it reads coalesce.
    pub(crate) fn listen(&self) -> (async_channel::Sender<()>, async_channel::Receiver<()>) {
        let (sender, receiver) = async_channel::bounded(1);
        if let Ok(mut listeners) = self.listeners.lock() {
            listeners.push(sender.clone());
        }
        (sender, receiver)
    }
}

fn notify(listeners: &Mutex<Vec<async_channel::Sender<()>>>) {
    let Ok(mut listeners) = listeners.lock() else {
        return;
    };
    listeners.retain(|listener| !listener.is_closed());
    for listener in listeners.iter() {
        let _ = listener.try_send(());
    }
}
