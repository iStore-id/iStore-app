import re

with open('src/pages/admin/AdminCampaignsPage.tsx', 'r') as f:
    content = f.read()

# Fix the broken sed
content = content.replace('''                        <button onClick={() => handleArchive(c.id)} className="text-gray-500 hover:text-purple-600 p-1.5 rounded-lg hover:bg-purple-50 transition" title="Arsipkan Campaign">
                          <Archive className="w-4 h-4" />
                        </button>
                        </div>
              )}''', '''                        <button onClick={() => handleArchive(c.id)} className="text-gray-500 hover:text-purple-600 p-1.5 rounded-lg hover:bg-purple-50 transition" title="Arsipkan Campaign">
                          <Archive className="w-4 h-4" />
                        </button>
                      )}''')

# Ensure the modal is properly closed
# Let's just fix the end of the showLegacyFields block
# It was:
#                       </div>
#                     )}
#                   </div>
#                 </div>
#               )}
# But with the sed it became:
#                       </div>
#                     )}
#                   </div>
#                 </div>
#                 </div>
#               )}
content = content.replace('''                      </div>
                    )}
                  </div>
                </div>
                </div>
              )}''', '''                      </div>
                    )}
                  </div>
                </div>
              )}''')

# Another place the sed might have messed up? Let's fix that.
content = content.replace('''                </div>
              )}
              {/* Schedule and Priority */}''', '''                </div>
              )}
              {/* Schedule and Priority */}''')

# Wait, the original problem was that showLegacyFields didn't have a closing </div> for the `<div className="space-y-5 animate-in ...">`
content = content.replace('''                    )}
                  </div>
                </div>
              )}
              {/* Schedule and Priority */}''', '''                    )}
                  </div>
                </div>
                </div>
              )}
              {/* Schedule and Priority */}''')

with open('src/pages/admin/AdminCampaignsPage.tsx', 'w') as f:
    f.write(content)
