import { useState, useEffect, useRef } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Send, Phone, Clock, ArrowDownLeft, ArrowUpRight,
  Search, RefreshCw, User, Loader2, MessageCircle, Smartphone,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface WhatsAppMessage {
  id: string;
  ticket_id: string | null;
  direction: string;
  from_number: string;
  to_number: string;
  body: string | null;
  media_url: string | null;
  twilio_sid: string | null;
  status: string | null;
  created_at: string;
}

interface Conversation {
  phoneNumber: string;
  lastMessage: string;
  lastTime: string;
  unreadCount: number;
  messages: WhatsAppMessage[];
}

export default function AdminWhatsApp() {
  const { lang } = useLanguage();
  const { session } = useAuth();
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAr = lang === 'ar';

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel('whatsapp-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, () => {
        fetchMessages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation, messages]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
      return;
    }

    setMessages(data || []);
    groupConversations(data || []);
    setLoading(false);
  };

  const groupConversations = (msgs: WhatsAppMessage[]) => {
    const convMap = new Map<string, WhatsAppMessage[]>();

    msgs.forEach(msg => {
      const phone = msg.direction === 'inbound'
        ? msg.from_number.replace('whatsapp:', '')
        : msg.to_number.replace('whatsapp:', '');
      if (!convMap.has(phone)) convMap.set(phone, []);
      convMap.get(phone)!.push(msg);
    });

    const convList: Conversation[] = Array.from(convMap.entries()).map(([phone, msgs]) => {
      const lastMsg = msgs[msgs.length - 1];
      return {
        phoneNumber: phone,
        lastMessage: lastMsg.body || '📎 وسائط',
        lastTime: lastMsg.created_at,
        unreadCount: msgs.filter(m => m.direction === 'inbound' && m.status === 'received').length,
        messages: msgs,
      };
    }).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());

    setConversations(convList);
  };

  const sendMessage = async (toNumber: string) => {
    if (!newMessage.trim() || !toNumber) return;
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: { to: toNumber, body: newMessage },
      });

      if (error) throw error;

      if (data?.twilio_connected === false) {
        toast.info(isAr ? 'تم حفظ الرسالة كمعلقة - يرجى ربط Twilio أولاً' : 'Message saved as pending - connect Twilio first');
      } else {
        toast.success(isAr ? 'تم إرسال الرسالة بنجاح' : 'Message sent successfully');
      }

      setNewMessage('');
      setShowNewChat(false);
      setNewNumber('');
      await fetchMessages();
    } catch (err: any) {
      toast.error(err.message || (isAr ? 'خطأ في إرسال الرسالة' : 'Error sending message'));
    } finally {
      setSending(false);
    }
  };

  const selectedMessages = selectedConversation
    ? conversations.find(c => c.phoneNumber === selectedConversation)?.messages || []
    : [];

  const filteredConversations = conversations.filter(c =>
    c.phoneNumber.includes(searchTerm) || c.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PageLayout>
      <PageHeader
        title={isAr ? 'رسائل WhatsApp' : 'WhatsApp Messages'}
        icon={<MessageSquare className="h-6 w-6" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
        {/* Conversations List */}
        <Card className="lg:col-span-1 flex flex-col overflow-hidden border-border/50">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-success" />
                {isAr ? 'المحادثات' : 'Conversations'}
                <Badge variant="secondary" className="text-xs">{conversations.length}</Badge>
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchMessages}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setShowNewChat(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={isAr ? 'بحث...' : 'Search...'}
                className="ps-9 h-9 text-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>

          <ScrollArea className="flex-1">
            <div className="px-3 pb-3 space-y-1">
              {/* New Chat Input */}
              <AnimatePresence>
                {showNewChat && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-2 mb-2"
                  >
                    <p className="text-xs font-medium text-primary">{isAr ? 'محادثة جديدة' : 'New Chat'}</p>
                    <Input
                      placeholder={isAr ? 'رقم الهاتف (مثال: +966...)' : 'Phone number (e.g. +966...)'}
                      value={newNumber}
                      onChange={e => setNewNumber(e.target.value)}
                      className="h-8 text-sm"
                      dir="ltr"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs flex-1" onClick={() => {
                        if (newNumber.trim()) {
                          setSelectedConversation(newNumber);
                          setShowNewChat(false);
                        }
                      }}>
                        {isAr ? 'بدء' : 'Start'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNewChat(false)}>
                        {isAr ? 'إلغاء' : 'Cancel'}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MessageCircle className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">{isAr ? 'لا توجد محادثات' : 'No conversations'}</p>
                </div>
              ) : (
                filteredConversations.map(conv => (
                  <motion.button
                    key={conv.phoneNumber}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedConversation(conv.phoneNumber)}
                    className={`w-full text-start p-3 rounded-xl transition-all duration-200 flex items-start gap-3 ${
                      selectedConversation === conv.phoneNumber
                        ? 'bg-primary/10 border border-primary/20 shadow-sm'
                        : 'hover:bg-muted/50 border border-transparent'
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-semibold truncate" dir="ltr">{conv.phoneNumber}</span>
                        {conv.unreadCount > 0 && (
                          <Badge className="h-5 min-w-5 text-[10px] bg-success text-white rounded-full">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {format(new Date(conv.lastTime), 'dd/MM HH:mm', { locale: isAr ? ar : undefined })}
                      </span>
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden border-border/50">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-border/50 flex items-center gap-3 bg-muted/30">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold" dir="ltr">{selectedConversation}</h3>
                  <p className="text-xs text-muted-foreground">
                    {isAr ? `${selectedMessages.length} رسالة` : `${selectedMessages.length} messages`}
                  </p>
                </div>
                {selectedMessages[0]?.ticket_id && (
                  <Badge variant="outline" className="ms-auto text-xs">
                    {isAr ? 'مرتبط بتذكرة' : 'Linked to ticket'}
                  </Badge>
                )}
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3 max-w-2xl mx-auto">
                  {selectedMessages.map((msg, i) => {
                    const isOutbound = msg.direction === 'outbound';
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                          isOutbound
                            ? 'bg-primary text-primary-foreground rounded-ee-md'
                            : 'bg-muted rounded-es-md'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                          <div className={`flex items-center gap-1.5 mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                            {isOutbound
                              ? <ArrowUpRight className="h-2.5 w-2.5 opacity-60" />
                              : <ArrowDownLeft className="h-2.5 w-2.5 opacity-60" />
                            }
                            <span className="text-[10px] opacity-60">
                              {format(new Date(msg.created_at), 'HH:mm')}
                            </span>
                            {msg.status && (
                              <span className="text-[9px] opacity-50">{msg.status}</span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="p-3 border-t border-border/50 bg-muted/20">
                <div className="flex gap-2 max-w-2xl mx-auto">
                  <Input
                    placeholder={isAr ? 'اكتب رسالتك...' : 'Type a message...'}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(selectedConversation); } }}
                    className="flex-1"
                    disabled={sending}
                  />
                  <Button
                    onClick={() => sendMessage(selectedConversation)}
                    disabled={!newMessage.trim() || sending}
                    size="icon"
                    className="shrink-0"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <div className="w-20 h-20 rounded-3xl bg-success/10 flex items-center justify-center mb-4">
                <MessageSquare className="h-10 w-10 text-success/50" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{isAr ? 'محادثات WhatsApp' : 'WhatsApp Conversations'}</h3>
              <p className="text-sm text-center max-w-sm">
                {isAr ? 'اختر محادثة من القائمة أو ابدأ محادثة جديدة' : 'Select a conversation or start a new one'}
              </p>
            </div>
          )}
        </Card>
      </div>
    </PageLayout>
  );
}
